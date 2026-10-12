import type { Elements } from 'claude-code'

import { hintKey } from './hints'
import type { Hint } from './hints'

// Only the elements every surface draws, so one view serves terminal and desktop alike.
type El = Pick<Elements[keyof Elements], 'Box' | 'Text' | 'Button'>
// Mobile draws no Input, so the pane's phrase field shows only where the surface has one.
type PaneEl = El & Partial<Pick<Elements['terminal'], 'Input'>>

export type Row = {
  hint: Hint
  slot?: number
  isPinned: boolean
  detail: string
}

export type PaneModel = {
  rows: Row[]
  hidden: string[]
  isImporting: boolean
  width: number
  phrase: string
}

export type Actions = {
  insert: (hint: Hint) => void
  pin: (hint: Hint) => void
  unpin: (hint: Hint) => void
  hide: (name: string) => void
  unhide: (name: string) => void
  typePhrase: (text: string) => void
  addPhrase: (text: string) => void
  reimport: () => void
}

const clip = (text: string, width: number) => (text.length > width ? text.slice(0, Math.max(0, width - 1)) + '…' : text)

const label = (hint: Hint, width = 24) => (hint.kind === 'command' ? hint.name : '"' + clip(hint.text, width) + '"')

const glyph = (hint: Hint) => (hint.kind === 'command' ? '◆' : '✎')

const glyphColor = (hint: Hint) => (hint.kind === 'command' ? 'suggestion' : 'warning')

// "pstack:how" reads as "how", unless another shown hint is also called "how".
function shortLabels(hints: Hint[]): string[] {
  const short = hints.map(hint => (hint.kind === 'command' ? (hint.name.split(':').pop() ?? hint.name) : label(hint, 18)))
  return short.map((name, i) => (short.indexOf(name) !== short.lastIndexOf(name) ? label(hints[i]!) : name))
}

export function Band({ Box, Text, Button }: El, hints: Hint[], insert: Actions['insert'], columns: number) {
  const labels = shortLabels(hints)
  return (
    <Box width={columns} borderStyle="round" borderDimColor paddingX={1} columnGap={3}>
      <Text color="claude" bold>
        ✻ Hints
      </Text>
      {hints.map((hint, i) => (
        <Box key={hintKey(hint)} columnGap={1}>
          <Text backgroundColor="suggestion" color="inverseText" bold>
            {' ' + (i + 1) + ' '}
          </Text>
          <Button key={'pick-' + hintKey(hint)} plain label={labels[i]} onPress={() => insert(hint)} />
        </Box>
      ))}
    </Box>
  )
}

export function ConsentBand({ Box, Text, Button }: El, answer: (isGranted: boolean) => void) {
  return (
    <Box borderStyle="round" borderDimColor paddingX={1} flexDirection="column">
      <Text>right-tool can learn your most used skills and commands from past sessions.</Text>
      <Text dimColor>
        It reads only command names, project folders and times from ~/.claude/projects. Nothing leaves your machine.
      </Text>
      <Box columnGap={2}>
        <Button key="consent-yes" variant="primary" label="Learn from history" onPress={() => answer(true)} />
        <Button key="consent-no" label="Start fresh" onPress={() => answer(false)} />
      </Box>
    </Box>
  )
}

function Card(el: El, row: Row, width: number, act: Actions) {
  const { Box, Text, Button } = el
  const { hint } = row
  return (
    <Box key={hintKey(hint)} borderStyle="round" borderDimColor paddingX={1} flexDirection="column">
      <Box justifyContent="space-between">
        <Box>
          <Text color={glyphColor(hint)}>{glyph(hint) + ' '}</Text>
          {row.slot !== undefined && <Text color="suggestion" bold>{'/' + row.slot + ' '}</Text>}
          <Text bold>{label(hint, width - 30)}</Text>
          {row.isPinned && <Text dimColor> · pinned</Text>}
        </Box>
        <Box columnGap={1}>
          <Button
            key={'pin-' + hintKey(hint)}
            label={row.isPinned ? 'Unpin' : 'Pin'}
            onPress={() => (row.isPinned ? act.unpin(hint) : act.pin(hint))}
          />
          {hint.kind === 'command' && (
            <Button key={'hide-' + hint.name} label="Hide" onPress={() => act.hide(hint.name)} />
          )}
        </Box>
      </Box>
      {row.detail !== '' && <Text dimColor>{clip(row.detail, width - 4)}</Text>}
    </Box>
  )
}

export function Pane(el: PaneEl, model: PaneModel, act: Actions) {
  const { Box, Text, Button, Input } = el
  return (
    <Box flexDirection="column" rowGap={1}>
      {Input && (
        <Input
          key="add-phrase"
          label="✎ Add a phrase "
          placeholder="e.g. run the tests and fix what fails"
          value={model.phrase}
          submitLabel="pin"
          onInput={act.typePhrase}
          onSubmit={act.addPhrase}
        />
      )}
      {model.rows.length === 0 && <Text dimColor>No uses yet. Type a skill or command, or pin one.</Text>}
      <Box flexDirection="column">{model.rows.map(row => Card(el, row, model.width, act))}</Box>
      {model.hidden.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Hidden</Text>
          {model.hidden.map(name => (
            <Box key={'hidden-' + name} columnGap={2}>
              <Text dimColor>{'/' + name}</Text>
              <Button key={'unhide-' + name} label="Unhide" onPress={() => act.unhide(name)} />
            </Box>
          ))}
        </Box>
      )}
      <Box columnGap={2}>
        <Button key="reimport" label={model.isImporting ? 'Reading…' : 'Re-import history'} onPress={act.reimport} />
        <Text dimColor>Type / then 1 to 5 to insert a hint.</Text>
      </Box>
    </Box>
  )
}
