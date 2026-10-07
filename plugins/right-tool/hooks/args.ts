import type { Hint } from './hints'

export type Action =
  | { kind: 'open' }
  | { kind: 'list' }
  | { kind: 'pin'; hint: Hint }
  | { kind: 'unpin'; target: string }
  | { kind: 'hide'; name: string }
  | { kind: 'unhide'; name: string }
  | { kind: 'import' }
  | { kind: 'error'; message: string }

export const USAGE = [
  'Usage:',
  '  /right-tool                   open the right-tool pane',
  '  /right-tool list              print hints, pins and hidden commands',
  '  /right-tool pin <command>     always show a command, e.g. pin code-review',
  '  /right-tool pin "<text>"      always show a snippet of text',
  '  /right-tool unpin <n|text>    remove a pin by its number or text',
  '  /right-tool hide <command>    never suggest a command',
  '  /right-tool unhide <command>  suggest it again',
  '  /right-tool import            rebuild usage from past sessions',
].join('\n')

const commandName = (raw: string) => raw.trim().replace(/^\//, '')

const unquote = (raw: string) => {
  const match = raw.trim().match(/^"(.*)"$|^'(.*)'$/s)
  return match ? (match[1] ?? match[2] ?? '') : null
}

export function parseArgs(args: string): Action {
  const trimmed = args.trim()
  const [verb = '', ...rest] = trimmed.split(/\s+/)
  const operand = trimmed.slice(verb.length).trim()

  switch (verb) {
    case '':
      return { kind: 'open' }
    case 'list':
      return { kind: 'list' }
    case 'import':
      return { kind: 'import' }
    case 'pin': {
      const text = unquote(operand)
      if (text !== null) return text ? { kind: 'pin', hint: { kind: 'text', text } } : { kind: 'error', message: USAGE }
      if (rest.length !== 1) return { kind: 'error', message: 'Quote a snippet that has spaces: /right-tool pin "run the tests"' }
      return { kind: 'pin', hint: { kind: 'command', name: commandName(operand) } }
    }
    case 'unpin':
      return operand ? { kind: 'unpin', target: unquote(operand) ?? operand } : { kind: 'error', message: USAGE }
    case 'hide':
    case 'unhide':
      return rest.length === 1 ? { kind: verb, name: commandName(operand) } : { kind: 'error', message: USAGE }
    default:
      return { kind: 'error', message: USAGE }
  }
}
