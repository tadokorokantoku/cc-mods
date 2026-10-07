import { expect, mock, test } from 'claude-code/testing'

const typed = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }
const commands = [{ name: 'code-review', description: 'Review the diff', source: 'plugin' as const }]

test('/right-tool pins a snippet and lists it', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: commands }))
  const pinned = await $.command.run({ ...typed, command: 'right-tool', args: 'pin "run the tests"' })
  expect(pinned.text).toBe('Pinned "run the tests".')

  const shown = await $.command.run({ ...typed, command: 'right-tool', args: 'list' })
  expect(shown.text).toContain('/1  "run the tests"  (pinned)')
  expect(shown.text).toContain('Pinned: "run the tests"')
})

test('/right-tool refuses to pin a command that does not exist', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: commands }))
  const answer = await $.command.run({ ...typed, command: 'right-tool', args: 'pin no-such-skill' })
  expect(answer.text).toBe('No skill or command named /no-such-skill.')
})
