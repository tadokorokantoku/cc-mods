import type { On, PromptEditInput, PromptEditResult } from 'claude-code'
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

// What sits beneath the plugins: the editor applies the splice, and the engine draws nothing of its own.
function editor(on: On) {
  on('prompt.edit', (_, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
}

// The test engine raises prompt.edit, though its types leave it out: plugins never call it.
type Edit = { prompt: { edit: (e: PromptEditInput) => Promise<PromptEditResult> } }
const edit = ($: unknown, e: PromptEditInput) => ($ as Edit).prompt.edit(e)

const slash = { origin: { kind: 'composer' as const }, text: '', cursor: 0, start: 0, end: 0, inputText: '/' }

test('the band asks before reading history, then shows pinned hints on every surface', async ($, on) => {
  mock.store(on)
  editor(on)
  on('command.list', () => ({ value: commands }))
  await $.command.run({ ...typed, command: 'right-tool', args: 'pin code-review' })
  await $.command.run({ ...typed, command: 'right-tool', args: 'pin "run the tests"' })
  await edit($, slash)

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

test('the band stays hidden until the prompt starts a command, and /1 inserts the first hint', async ($, on) => {
  mock.store(on)
  editor(on)
  on('command.list', () => ({ value: commands }))
  await $.command.run({ ...typed, command: 'right-tool', args: 'pin code-review' })
  const ui = await $.ui.mount({ plugin: 'right-tool', surface: 'terminal', ...BAND })
  await ui.press({ key: 'consent-no' })
  expect(await ui.find({ key: 'pick-/code-review' })).toBeUndefined()

  await edit($, slash)
  expect(await ui.find({ key: 'pick-/code-review' })).toBeDefined()

  const box = await edit($, { ...slash, text: '/', cursor: 1, start: 1, end: 1, inputText: '1' })
  expect(box.text).toBe('/code-review ')
  expect(await ui.find({ key: 'pick-/code-review' })).toBeUndefined()
  await ui.unmount()
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
