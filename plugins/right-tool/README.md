# right-tool

Shows the skills and slash commands you use most, plus snippets you pin, in a band above the Claude Code prompt while you type a `/` command.

```
╭───────────────────────────────────────────────────────────────╮
│ ✻ Hints    1  code-review    2  simplify    3  how    4  tdd  │
╰───────────────────────────────────────────────────────────────╯
```

On its first run, right-tool reads the command names in your past Claude Code sessions to rank hints. Everything stays on your machine. See [Privacy](#privacy).

## Use it

- Type `/` in an empty prompt. The band appears above the prompt, next to Claude Code's own command list, and hides again once you type a space or send.
- Type a digit from `1` to `5` right after the `/`. The prompt becomes that hint, for example `/code-review `, ready for arguments. Nothing is sent until you press Enter.
- Click a hint to insert it.
- Run `/right-tool` to open a pane that lists every hint with Pin and Hide buttons.

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

right-tool sends nothing anywhere. It makes no network requests, calls no model, and starts no programs except the one below.

**What it reads**

- In its first session, and when you run `/right-tool import` or press Re-import, it reads past sessions to count the slash commands you typed. It shows a notice saying how many uses it found.
- It keeps three fields per typed command: the command name, the session's working directory and the time. It keeps nothing else from the transcripts.
- It stores those counts and your pins in this plugin's own store under your Claude Code configuration directory.

**The one program it runs**

To read past sessions it runs `grep` directly, with no shell, in your `~/.claude/projects` folder:

```sh
cd ~/.claude/projects && grep -rh --include=*.jsonl -F "<command-name>/" .
```

`grep` keeps only the transcript lines that mention a typed slash command. right-tool then takes the command name, working directory and time from each of those lines and drops the rest. `grep` reads local files only. The call is written out in full in `hooks/register.tsx`.

**What its hooks see**

| Hook | What it does |
| --- | --- |
| `prompt.edit` | Reads the prompt as you type, only to check whether it is `/` and a command name, and to turn `/1` to `/5` into a hint. Every other edit passes through unchanged. |
| `command.run` | Counts the name of each slash command you run, then lets the command run unchanged. It also answers `/right-tool` itself. |
| `prompt.submit` | Hides the band when you send a prompt. The prompt passes through unchanged. |
| `ui.render` | Draws the band above the prompt and the `/right-tool` pane. |
| `session.start` | Loads the counts, lists installed commands and registers `/right-tool`. |

## Requirements

- Claude Code v2.1.287 or later. Tested with v2.1.292.
- The Claude Code terminal or desktop app. The hint band draws only on those two.
- `grep` on your `PATH` for the history import, as macOS and Linux have. Everything else works without it.

## License

MIT. See [LICENSE](LICENSE).
