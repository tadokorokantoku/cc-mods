export type Hint = { kind: 'command'; name: string } | { kind: 'text'; text: string }

// `score` is the decayed use count as of `at`; `count` is the raw total.
export type Stat = { score: number; count: number; at: number }

export type Usage = {
  global: Record<string, Stat>
  projects: Record<string, Record<string, Stat>>
}

export type Prefs = { pins: Hint[]; hidden: string[] }

export type Ranked = { hint: Hint; count: number; isPinned: boolean }

export type RankOptions = { halfLifeDays: number; projectWeight: number; limit: number }

const DAY = 86_400_000

export const emptyUsage = (): Usage => ({ global: {}, projects: {} })
export const emptyPrefs = (): Prefs => ({ pins: [], hidden: [] })

const weight = (from: number, to: number, halfLifeDays: number) =>
  Math.pow(2, -(to - from) / (halfLifeDays * DAY))

export function decayed(stat: Stat | undefined, now: number, halfLifeDays: number): number {
  return stat ? stat.score * weight(stat.at, now, halfLifeDays) : 0
}

function bump(stat: Stat | undefined, at: number, halfLifeDays: number): Stat {
  if (!stat) return { score: 1, count: 1, at }
  // Uses can arrive out of order (history import), so decay whichever is older.
  return at >= stat.at
    ? { score: stat.score * weight(stat.at, at, halfLifeDays) + 1, count: stat.count + 1, at }
    : { score: stat.score + weight(at, stat.at, halfLifeDays), count: stat.count + 1, at: stat.at }
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

