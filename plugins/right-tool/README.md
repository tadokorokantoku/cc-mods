# right-tool

Shows the skills and slash commands you use most, plus snippets you pin, in a band above the Claude Code prompt.

```
╭───────────────────────────────────────────────────────────────╮
│ ✻ Hints    1  code-review    2  simplify    3  how    4  tdd  │
╰───────────────────────────────────────────────────────────────╯
```

## Use it

- Type `/1` to `/5` in an empty prompt. The prompt becomes that hint, for example `/code-review `, ready for arguments. Nothing is sent until you press Enter.
- Click a hint to insert it.
- Run `/right-tool` to open a pane with usage per hint, a 14-day sparkline and Pin, Hide and Insert buttons.

| Command | What it does |
| --- | --- |
| `/right-tool` | Open the pane |
| `/right-tool list` | Print the hints, pins and hidden commands |
| `/right-tool pin code-review` | Always show a skill or command |
| `/right-tool pin "run the tests and fix failures"` | Always show a snippet of text |
| `/right-tool unpin 1` | Remove a pin by its number or text |
| `/right-tool hide <command>` / `unhide <command>` | Stop or resume suggesting a command |
| `/right-tool import` | Rebuild usage from past sessions |

## How hints are ranked

- Only commands you type count. Skills Claude calls on its own do not.
- Each use counts half as much after 14 days.
- A use in the current project counts 3 times as much as a use elsewhere.
- Pinned hints come first. Claude Code's built-in commands such as `/clear` are never suggested.

Change the half-life and project weight in `/config`, under right-tool.

## Privacy

On first run the band asks before reading past sessions. If you agree, right-tool searches `~/.claude/projects/**/*.jsonl` with `grep` and `awk` and keeps three fields per typed slash command: its name, the session's working directory and the time. It keeps nothing else and sends nothing over the network. Usage is stored in this plugin's own store under your Claude Code configuration directory.

## Requirements

- Claude Code v2.1.287 or later. Tested with v2.1.292.
- macOS or Linux for the history import, which runs `sh`, `grep` and `awk`. Everything else works on any platform.
