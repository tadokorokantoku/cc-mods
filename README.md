# cc-mods

Mods for [Claude Code](https://code.claude.com): plugins whose hooks module draws and reacts inside the Claude Code interface.

| Mod | What it does |
| --- | --- |
| [right-tool](plugins/right-tool) | Shows your most used skills, commands and pinned snippets above the prompt. Type `/1` to `/5` in an empty prompt to insert one. |

## Install

At a Claude Code prompt in a terminal, run:

```
/plugin install right-tool --marketplace tadokorokantoku/cc-mods
```

Answer `y` to add the marketplace, then pick a scope. Mods need Claude Code v2.1.287 or later.

## Develop

Load a mod from its folder for one session. Saving a file reloads it.

```bash
claude --plugin-dir ./plugins/right-tool
```

Check and test it:

```bash
claude plugin validate ./plugins/right-tool
claude plugin test ./plugins/right-tool
```

To add a mod, create `plugins/<name>/` and add an entry for it to `.claude-plugin/marketplace.json`.
