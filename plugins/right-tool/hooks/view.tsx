import type { Elements } from 'claude-code'

import { hintKey } from './hints'
import type { Hint } from './hints'

// Only the elements every surface draws, so one view serves terminal and desktop alike.
type El = Pick<Elements[keyof Elements], 'Box' | 'Text' | 'Button'>

export type Row = {
  hint: Hint
  slot?: number
  isPinned: boolean
  count: number
  daily: number[]
  detail: string
}

export type PaneModel = {
  uses: number
  tools: number
  streak: number
  rows: Row[]
  hidden: string[]
  isImporting: boolean
  width: number
}

export type Actions = {
  insert: (hint: Hint) => void
  pin: (hint: Hint) => void
  unpin: (hint: Hint) => void
  hide: (name: string) => void
  unhide: (name: string) => void
  reimport: () => void
}

const SPARK = '▁▂▃▄▅▆▇█'

const sparkline = (values: number[]) => {
  const max = Math.max(1, ...values)
  return values.map(v => (v === 0 ? '·' : SPARK[Math.min(7, Math.ceil((v / max) * 8) - 1)])).join('')
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

function Tile({ Box, Text }: El, name: string, value: string) {
  return (
    <Box key={name} borderStyle="round" borderDimColor paddingX={1} flexDirection="column" flexGrow={1}>
      <Text dimColor>{name}</Text>
      <Text bold>{value}</Text>
    </Box>
  )
}

function Card(el: El, row: Row, maxCount: number, width: number, act: Actions) {
  const { Box, Text, Button } = el
  const { hint } = row
  const barWidth = 16
  const filled = Math.round((row.count / Math.max(1, maxCount)) * barWidth)
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
          <Button key={'insert-' + hintKey(hint)} label="Insert" onPress={() => act.insert(hint)} />
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
      {hint.kind === 'command' && (
        <Box>
          <Text color="suggestion">{sparkline(row.daily) + '  '}</Text>
          <Text color="claude">{'━'.repeat(filled)}</Text>
          <Text dimColor>{'─'.repeat(barWidth - filled) + '  ' + row.count + 'x'}</Text>
        </Box>
      )}
    </Box>
  )
}

export function Pane(el: El, model: PaneModel, act: Actions) {
  const { Box, Text, Button } = el
  const maxCount = Math.max(1, ...model.rows.map(r => r.count))
  return (
    <Box flexDirection="column" rowGap={1}>
      <Box columnGap={1}>
        {Tile(el, 'Uses here', String(model.uses))}
        {Tile(el, 'Tools here', String(model.tools))}
        {Tile(el, 'Streak', model.streak + (model.streak === 1 ? ' day' : ' days'))}
      </Box>
      {model.rows.length === 0 && <Text dimColor>No uses yet. Type a skill or command, or pin one.</Text>}
      <Box flexDirection="column">{model.rows.map(row => Card(el, row, maxCount, model.width, act))}</Box>
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
        <Text dimColor>Type /1 to /5 in an empty prompt to insert a hint.</Text>
      </Box>
    </Box>
  )
}
