export type Hint = { kind: 'command'; name: string } | { kind: 'text'; text: string }

// `score` is the decayed use count as of `at`; `count` is the raw total;
// `days` counts uses per UTC day for the most recent KEEP_DAYS days used.
export type Stat = { score: number; count: number; at: number; days?: Record<string, number> }

export type Usage = {
  global: Record<string, Stat>
  projects: Record<string, Record<string, Stat>>
}

export type Prefs = { pins: Hint[]; hidden: string[] }

export type Ranked = { hint: Hint; count: number; isPinned: boolean }

export type RankOptions = { halfLifeDays: number; projectWeight: number; limit: number }

const DAY = 86_400_000
const KEEP_DAYS = 30

const dayKey = (at: number) => new Date(at).toISOString().slice(0, 10)

function addDay(days: Record<string, number> = {}, at: number): Record<string, number> {
  const key = dayKey(at)
  const next = { ...days, [key]: (days[key] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)).slice(-KEEP_DAYS))
}

export const emptyUsage = (): Usage => ({ global: {}, projects: {} })
export const emptyPrefs = (): Prefs => ({ pins: [], hidden: [] })

const weight = (from: number, to: number, halfLifeDays: number) =>
  Math.pow(2, -(to - from) / (halfLifeDays * DAY))

export function decayed(stat: Stat | undefined, now: number, halfLifeDays: number): number {
  return stat ? stat.score * weight(stat.at, now, halfLifeDays) : 0
}

function bump(stat: Stat | undefined, at: number, halfLifeDays: number): Stat {
  if (!stat) return { score: 1, count: 1, at, days: addDay({}, at) }
  const days = addDay(stat.days, at)
  // Uses can arrive out of order (history import), so decay whichever is older.
  return at >= stat.at
    ? { score: stat.score * weight(stat.at, at, halfLifeDays) + 1, count: stat.count + 1, at, days }
    : { score: stat.score + weight(at, stat.at, halfLifeDays), count: stat.count + 1, at: stat.at, days }
}

export function record(usage: Usage, name: string, project: string, at: number, halfLifeDays: number): Usage {
  const inProject = usage.projects[project] ?? {}
  return {
    global: { ...usage.global, [name]: bump(usage.global[name], at, halfLifeDays) },
    projects: {
      ...usage.projects,
      [project]: { ...inProject, [name]: bump(inProject[name], at, halfLifeDays) },
    },
  }
}

export const hintKey = (hint: Hint) => (hint.kind === 'command' ? '/' + hint.name : hint.text)

export const insertText = (hint: Hint) => (hint.kind === 'command' ? '/' + hint.name + ' ' : hint.text)

export function rank(
  usage: Usage,
  prefs: Prefs,
  project: string,
  available: ReadonlySet<string>,
  now: number,
  { halfLifeDays, projectWeight, limit }: RankOptions,
): Ranked[] {
  const countOf = (hint: Hint) => (hint.kind === 'command' ? (usage.global[hint.name]?.count ?? 0) : 0)
  const pinned = prefs.pins
    .filter(hint => hint.kind === 'text' || available.has(hint.name))
    .map(hint => ({ hint, count: countOf(hint), isPinned: true }))
  const taken = new Set(pinned.map(p => hintKey(p.hint)))
  const inProject = usage.projects[project] ?? {}

  const ranked = Object.keys(usage.global)
    .filter(name => available.has(name) && !prefs.hidden.includes(name) && !taken.has('/' + name))
    .map(name => ({
      name,
      score:
        projectWeight * decayed(inProject[name], now, halfLifeDays) + decayed(usage.global[name], now, halfLifeDays),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ name }): Ranked => {
      const hint: Hint = { kind: 'command', name }
      return { hint, count: countOf(hint), isPinned: false }
    })

  return [...pinned, ...ranked].slice(0, limit)
}

// Uses per day for the `span` days ending today, oldest first.
export function daily(stat: Stat | undefined, now: number, span: number): number[] {
  return Array.from({ length: span }, (_, i) => stat?.days?.[dayKey(now - (span - 1 - i) * DAY)] ?? 0)
}

// Consecutive days with any use, counting back from today, or from yesterday when today has none yet.
export function streak(stats: Record<string, Stat>, now: number): number {
  const used = (at: number) => Object.values(stats).some(stat => (stat.days?.[dayKey(at)] ?? 0) > 0)
  let day = used(now) ? now : now - DAY
  let length = 0
  while (used(day)) {
    length += 1
    day -= DAY
  }
  return length
}
