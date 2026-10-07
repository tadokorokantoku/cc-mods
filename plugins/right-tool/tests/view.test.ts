import { expect, mock, test } from 'claude-code/testing'

const typed = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }
const commands = [{ name: 'code-review', description: 'Review the current diff', source: 'plugin' as const, plugin: 'pstack' }]
const scroll = { offset: 0, bodyRows: 20 }
const BAND = { component: 'AbovePrompt' as const, props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll, view: {} } }
const PANE = {
  component: 'Pane' as const,
  requestId: 'right-tool',
  props: { title: 'right-tool', isFocused: false, bodyColumns: 80, placement: 'dock' as const, scroll, view: {} },
}

test('the band asks before reading history, then shows pinned hints on every surface', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: commands }))
  await $.command.run({ ...typed, command: 'right-tool', args: 'pin code-review' })
  await $.command.run({ ...typed, command: 'right-tool', args: 'pin "run the tests"' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'right-tool', surface, ...BAND })
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /learn your most used/ })).toBeDefined()
      await ui.press({ key: 'consent-no' })
    }
    expect((await ui.find({ key: 'pick-/code-review' }))?.props.label).toBe('code-review')
    expect((await ui.find({ key: 'pick-run the tests' }))?.props.label).toBe('"run the tests"')
    await ui.unmount()
  }
})

test('the pane shows a card per hint and unpins from its button', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: commands }))
  await $.command.run({ ...typed, command: 'right-tool', args: 'pin code-review' })

  const ui = await $.ui.mount({ plugin: 'right-tool', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /pstack · Review the current diff/ })).toBeDefined()
  await ui.press({ key: 'pin-/code-review' })
  const listed = await $.command.run({ ...typed, command: 'right-tool', args: 'list' })
  expect(listed.text).toContain('Pinned: none')
  await ui.unmount()
})
