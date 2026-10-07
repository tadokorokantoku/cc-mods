import type { CommandInfo, EngineInterface, Register } from 'claude-code'

import { parseArgs, USAGE } from './args'
import type { Action } from './args'
import { daily, emptyPrefs, emptyUsage, hintKey, insertText, rank, record, streak } from './hints'
import type { Hint, Prefs, Ranked, Usage } from './hints'
import { historyArgv, parseHistory } from './history'
import { Band, ConsentBand, Pane } from './view'
import type { Actions, PaneModel } from './view'

const SELF = 'right-tool'
const PANE = 'right-tool'
const SLOTS = 5
const PANE_ROWS = 12
const SPARK_DAYS = 14

type Consent = 'granted' | 'declined'

let halfLifeDays = 14
let projectWeight = 3
let usage: Usage = emptyUsage()
let prefs: Prefs = emptyPrefs()
let consent: Consent | undefined
let isImporting = false
let project = ''
let commands = new Map<string, CommandInfo>()
let ranked: Ranked[] = []

const slots = () => ranked.slice(0, SLOTS)

function rerank() {
  const opts = { halfLifeDays, projectWeight, limit: PANE_ROWS }
  ranked = rank(usage, prefs, project, new Set(commands.keys()), Date.now(), opts)
}

async function refreshCommands($: EngineInterface) {
  const list = await $.command.list()
  commands = new Map(list.filter(c => c.source !== 'builtin' && c.name !== SELF).map(c => [c.name, c]))
}

async function load($: EngineInterface) {
  usage = ((await $.store.get('usage')) as Usage | undefined) ?? emptyUsage()
  prefs = ((await $.store.get('prefs')) as Prefs | undefined) ?? emptyPrefs()
  consent = (await $.store.get('consent')) as Consent | undefined
  project = await $.session.cwd()
  await refreshCommands($)
  rerank()
}

async function recordUse($: EngineInterface, name: string) {
  usage = record(usage, name, project, Date.now(), halfLifeDays)
  await $.store.set('usage', usage)
  if (!commands.has(name)) await refreshCommands($)
  rerank()
  $.ui.invalidate('ui.render')
}

async function savePrefs($: EngineInterface) {
  await $.store.set('prefs', prefs)
  rerank()
  $.ui.invalidate('ui.render')
}

// Rebuilds usage from every transcript, so running it twice never double counts.
async function importHistory($: EngineInterface): Promise<string> {
  const home = await $.env.get('HOME')
  if (!home) return 'HOME is not set, so past sessions cannot be found.'
  isImporting = true
  $.ui.invalidate('ui.render')
  try {
    const { exitCode, stdout, stderr } = await $.process.run(historyArgv(home + '/.claude/projects'), {
      timeoutMs: 120_000,
    })
    // grep exits 1 when nothing matched, which is an empty history, not a failure.
    if (exitCode > 1) return 'Reading past sessions failed: ' + stderr.trim()
    const uses = parseHistory(stdout).filter(use => use.name !== SELF)
    usage = uses.reduce((next, use) => record(next, use.name, use.project, use.at, halfLifeDays), emptyUsage())
    await $.store.set('usage', usage)
    rerank()
    return `Learned ${uses.length} commands from past sessions.`
  } finally {
    isImporting = false
    $.ui.invalidate('ui.render')
  }
}

async function answerConsent($: EngineInterface, value: Consent) {
  consent = value
  await $.store.set('consent', value)
  $.ui.invalidate('ui.render')
  if (value === 'granted') $.ui.toast(await importHistory($))
}

const describe = (hint: Hint) => (hint.kind === 'command' ? '/' + hint.name : JSON.stringify(hint.text))

function listText(): string {
  const lines = slots().map((h, i) => `  /${i + 1}  ${describe(h.hint)}${h.isPinned ? '  (pinned)' : ''}  used ${h.count}x`)
  return [
    lines.length > 0 ? 'Hints (type /1 to /5 in an empty prompt):' : 'No hints yet. Use a few skills or commands first.',
    ...lines,
    'Pinned: ' + (prefs.pins.length > 0 ? prefs.pins.map(describe).join(', ') : 'none'),
    'Hidden: ' + (prefs.hidden.length > 0 ? prefs.hidden.map(n => '/' + n).join(', ') : 'none'),
    '',
    USAGE,
  ].join('\n')
}

async function applyAction($: EngineInterface, action: Action): Promise<string> {
  switch (action.kind) {
    case 'open':
      await $.ui.open({ id: PANE, title: 'right-tool' })
      return 'Opened the right-tool pane.'
    case 'list':
      return listText()
    case 'error':
      return action.message
    case 'import':
      consent = 'granted'
      await $.store.set('consent', consent)
      return importHistory($)
    case 'pin': {
      if (action.hint.kind === 'command' && !commands.has(action.hint.name)) {
        await refreshCommands($)
        if (!commands.has(action.hint.name)) return `No skill or command named /${action.hint.name}.`
      }
      const key = hintKey(action.hint)
      prefs = { ...prefs, pins: [...prefs.pins.filter(p => hintKey(p) !== key), action.hint] }
      await savePrefs($)
      return `Pinned ${describe(action.hint)}.`
    }
    case 'unpin': {
      const { target } = action
      const byNumber = prefs.pins[Number(target) - 1]
      const pin = byNumber ?? prefs.pins.find(p => hintKey(p) === target || (p.kind === 'command' && p.name === target))
      if (!pin) return `Nothing pinned matches ${target}.`
      prefs = { ...prefs, pins: prefs.pins.filter(p => p !== pin) }
      await savePrefs($)
      return `Unpinned ${describe(pin)}.`
    }
    case 'hide':
      prefs = { ...prefs, hidden: [...prefs.hidden.filter(n => n !== action.name), action.name] }
      await savePrefs($)
      return `/${action.name} will not be suggested.`
    case 'unhide':
      prefs = { ...prefs, hidden: prefs.hidden.filter(n => n !== action.name) }
      await savePrefs($)
      return `/${action.name} can be suggested again.`
  }
}

function actions($: EngineInterface): Actions {
  return {
    insert: hint => void $.prompt.fill({ text: insertText(hint), mode: 'replace' }),
    pin: hint => void applyAction($, { kind: 'pin', hint }),
    unpin: hint => void applyAction($, { kind: 'unpin', target: hintKey(hint) }),
    hide: name => void applyAction($, { kind: 'hide', name }),
    unhide: name => void applyAction($, { kind: 'unhide', name }),
    reimport: () => void importHistory($).then(text => $.ui.toast(text)),
  }
}

function detail(hint: Hint): string {
  if (hint.kind === 'text') return 'snippet'
  const info = commands.get(hint.name)
  return info ? (info.plugin ?? info.source) + ' · ' + info.description : ''
}

function paneModel(width: number): PaneModel {
  const now = Date.now()
  const here = Object.values(usage.projects[project] ?? {})
  return {
    uses: here.reduce((sum, stat) => sum + stat.count, 0),
    tools: here.length,
    streak: streak(usage.global, now),
    rows: ranked.map(({ hint, count, isPinned }, i) => ({
      hint,
      slot: i < SLOTS ? i + 1 : undefined,
      isPinned,
      count,
      daily: hint.kind === 'command' ? daily(usage.global[hint.name], now, SPARK_DAYS) : [],
      detail: detail(hint),
    })),
    hidden: prefs.hidden,
    isImporting,
    width,
  }
}

export const register: Register = (on, options) => {
  halfLifeDays = Number(options.halfLifeDays) > 0 ? Number(options.halfLifeDays) : 14
  projectWeight = Number(options.projectWeight) >= 0 ? Number(options.projectWeight) : 3

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: SELF, description: 'Open the right-tool pane, or pin and hide hints' })
    await load($)
    return next(e)
  })

  on('command.run', { command: 'right-tool' }, async ($, e) => ({ text: await applyAction($, parseArgs(e.args ?? '')) }))

  // Only commands the person typed count: Claude's own Skill tool calls never reach command.run.
  on('command.run', async ($, e, next) => {
    if (e.origin.kind === 'composer' && e.command !== SELF) await recordUse($, e.command)
    return next(e)
  })

  // "/1" to "/5" typed into an empty prompt becomes that hint. No command name starts with a digit.
  on('prompt.edit', ($, e, next) => {
    const hint = slots()[Number(e.inputText) - 1]?.hint
    if (e.text !== '/' || e.cursor !== 1 || !/^[1-9]$/.test(e.inputText) || !hint) return next(e)
    const text = insertText(hint)
    return { text, cursor: text.length }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)
    const el = $.ui.resolve(e)
    if (consent === undefined) return ConsentBand(el, isGranted => void answerConsent($, isGranted ? 'granted' : 'declined'))
    if (slots().length === 0) return next(e)
    return Band(el, slots().map(s => s.hint), actions($).insert)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) =>
    Pane($.ui.resolve(e), paneModel(e.props.bodyColumns), actions($)),
  )
}
