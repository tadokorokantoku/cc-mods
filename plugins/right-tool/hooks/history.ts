// Reads past slash commands out of Claude Code transcripts. Only the command
// name, the session's working directory and the time leave the transcript.

export type PastUse = { name: string; project: string; at: number }

export function parseHistory(tsv: string): PastUse[] {
  return tsv.split('\n').flatMap(line => {
    const [name, project, time] = line.split('\t')
    const at = Date.parse(time ?? '')
    return name && project && !Number.isNaN(at) ? [{ name, project, at }] : []
  })
}
