import { expect, test } from 'claude-code/testing'

import { parseArgs } from '../hooks/args'
import { emptyPrefs, emptyUsage, rank, record } from '../hooks/hints'
import { parseHistory } from '../hooks/history'

const DAY = 86_400_000
const now = Date.parse('2026-10-08T00:00:00Z')
const opts = { halfLifeDays: 14, projectWeight: 3, limit: 5 }
const all = new Set(['code-review', 'simplify', 'wrangler', 'tdd'])
const names = (r: ReturnType<typeof rank>) => r.map(x => (x.hint.kind === 'command' ? x.hint.name : x.hint.text))

test('a command used in this project outranks one used more often elsewhere', () => {
  let usage = emptyUsage()
  usage = record(usage, 'wrangler', '/repo', now, 14)
  for (let i = 0; i < 3; i++) usage = record(usage, 'tdd', '/other', now, 14)
  expect(names(rank(usage, emptyPrefs(), '/repo', all, now, opts))).toEqual(['wrangler', 'tdd'])
})

test('old uses fade: one use a month ago loses to one use today', () => {
  let usage = emptyUsage()
  usage = record(usage, 'tdd', '/repo', now - 30 * DAY, 14)
  usage = record(usage, 'tdd', '/repo', now - 30 * DAY, 14)
  usage = record(usage, 'simplify', '/repo', now, 14)
  expect(names(rank(usage, emptyPrefs(), '/repo', all, now, opts))).toEqual(['simplify', 'tdd'])
})

test('uses recorded out of order score the same as in order', () => {
  const a = record(record(emptyUsage(), 'tdd', '/r', now - DAY, 14), 'tdd', '/r', now, 14)
  const b = record(record(emptyUsage(), 'tdd', '/r', now, 14), 'tdd', '/r', now - DAY, 14)
  const [x, y] = [a.global['tdd'], b.global['tdd']]
  expect(Math.abs((x?.score ?? 0) - (y?.score ?? 1))).toBeLessThan(1e-9)
  expect(y?.count).toBe(2)
})

test('pins come first, hidden and uninstalled commands never show, and the list is capped', () => {
  let usage = emptyUsage()
  for (const name of ['code-review', 'simplify', 'wrangler', 'tdd', 'gone']) usage = record(usage, name, '/repo', now, 14)
  const prefs = { pins: [{ kind: 'text' as const, text: 'run the tests' }], hidden: ['simplify'] }
  const ranked = names(rank(usage, prefs, '/repo', all, now, { ...opts, limit: 3 }))
  expect(ranked[0]).toBe('run the tests')
  expect(ranked).toHaveLength(3)
  expect(ranked).not.toContain('simplify')
  expect(ranked).not.toContain('gone')
})

test('parseHistory reads name, project and time, skipping broken rows', () => {
  const tsv = 'pstack:bro\t/Users/me/app\t2026-10-07T12:00:00.000Z\nbroken\n\nloop\t/x\tnot-a-date\n'
  expect(parseHistory(tsv)).toEqual([{ name: 'pstack:bro', project: '/Users/me/app', at: Date.parse('2026-10-07T12:00:00.000Z') }])
})

test('parseArgs tells snippets from commands', () => {
  expect(parseArgs('pin "run the tests"')).toEqual({ kind: 'pin', hint: { kind: 'text', text: 'run the tests' } })
  expect(parseArgs('pin /code-review')).toEqual({ kind: 'pin', hint: { kind: 'command', name: 'code-review' } })
  expect(parseArgs('pin run the tests').kind).toBe('error')
  expect(parseArgs('hide simplify')).toEqual({ kind: 'hide', name: 'simplify' })
  expect(parseArgs('unpin 2')).toEqual({ kind: 'unpin', target: '2' })
})
