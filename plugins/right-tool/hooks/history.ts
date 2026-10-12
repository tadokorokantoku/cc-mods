// Reads past slash commands out of Claude Code transcripts. Only the command
// name, the session's working directory and the time leave the transcript.

export type PastUse = { name: string; project: string; at: number }

type Row = { type?: unknown; isSidechain?: unknown; cwd?: unknown; timestamp?: unknown; message?: { content?: unknown } }

// A typed slash command is a main-thread user row whose content starts with the
// <command-name> or <command-message> tag; tool results that merely contain it don't.
export function parseHistory(jsonl: string): PastUse[] {
  return jsonl.split('\n').flatMap(line => {
    let row: Row
    try {
      row = JSON.parse(line) as Row
    } catch {
      return []
    }
    const content = row.message?.content
    if (row.type !== 'user' || row.isSidechain !== false || typeof content !== 'string') return []
    if (!/^<command-(name|message)>/.test(content)) return []
    const name = /<command-name>\/([^<]+)</.exec(content)?.[1]
    const at = Date.parse(typeof row.timestamp === 'string' ? row.timestamp : '')
    return name && typeof row.cwd === 'string' && !Number.isNaN(at) ? [{ name, project: row.cwd, at }] : []
  })
}
