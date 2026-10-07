// Reads past slash commands out of Claude Code transcripts. Only the command
// name, the session's working directory and the time leave the transcript.

export type PastUse = { name: string; project: string; at: number }

// A typed slash command is a user row whose content starts with the
// <command-message>/<command-name> tags; tool results that merely contain the
// tags do not start with them.
const AWK = `/"type":"user"/ && /"isSidechain":false/ && /"content":"<command-(message|name)>/ {
  n = c = t = ""
  if (match($0, /<command-name>\\/[^<]+</)) n = substr($0, RSTART + 15, RLENGTH - 16)
  if (match($0, /"cwd":"[^"]*"/)) c = substr($0, RSTART + 7, RLENGTH - 8)
  if (match($0, /"timestamp":"[^"]*"/)) t = substr($0, RSTART + 13, RLENGTH - 14)
  if (n != "" && c != "" && t != "") print n "\\t" c "\\t" t
}`

// grep narrows the files to matching lines first so awk never sees whole transcripts.
export const historyArgv = (projectsDir: string) => [
  'sh',
  '-c',
  `grep -rh --include='*.jsonl' -F '<command-name>/' "$1" | awk "$2"`,
  'sh',
  projectsDir,
  AWK,
]

export function parseHistory(tsv: string): PastUse[] {
  return tsv.split('\n').flatMap(line => {
    const [name, project, time] = line.split('\t')
    const at = Date.parse(time ?? '')
    return name && project && !Number.isNaN(at) ? [{ name, project, at }] : []
  })
}
