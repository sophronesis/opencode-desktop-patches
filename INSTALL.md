# opencode desktop - full install guide

complete setup for the environment this repo exists for. reflects the fw16
nixos machine as of 2026-11-17. repo layout:

- `patches/` - source patches against the opencode desktop monorepo (see main [README](README.md))
- `nix/` - the nix wiring that applies the patches + telegram-blue asar wrapper
- `plugins/` - the four opencode plugins (pills/widgets included), source-only mirrors
- `INSTALL.md` - this file

## 1. core app + source patches

the desktop app is nixpkgs `opencode-desktop` 2.2.1, resolved through
[nixpkgs-multiverse](https://github.com/fzakaria/nixpkgs-multiverse) (unstable's
newer releases had no hydra build), then patched and wrapped. the full nix
wiring is vendored in this repo under `nix/packages/` (mirrors of the
[nixos config](https://github.com/sophronesis/nixos) `packages/` dir,
patch paths adjusted to `../../patches/`):

- `modules/pkgs.nix` in the config: `(pin "opencode" "latest")` for the TUI, plus the package chain:
  ```nix
  (callPackage ./../packages/opencode-desktop-telegram-blue/package.nix {
    opencode-desktop = callPackage ./../packages/opencode-desktop-generic-tool/package.nix { };
  })
  ```
- `nix/packages/opencode-desktop-generic-tool/package.nix` - applies `patches/generic-tool-expandable.patch`
  and `patches/spinner-verbs.patch` via `overrideAttrs` on the multiverse `.eval` derivation
  (the `pin` result is a fake drv without `overrideAttrs`, hence `.eval`)
- `nix/packages/opencode-desktop-telegram-blue/package.nix` - copies the patched derivation and
  byte-patches `app.asar` CSS for telegram-blue user bubbles (same-length edits; the
  derivation name must stay identical). `patch-telegram-blue.py` asserts on every
  anchor and fails loudly on bumps.

without nixos, apply the patches to a monorepo checkout at tag v2.2.1 and build:

```sh
git apply --check patches/generic-tool-expandable.patch
git apply patches/generic-tool-expandable.patch
git apply patches/spinner-verbs.patch
```

**version bump checklist** (also in the generic-tool package.nix header):
1. rebase both patches against the new monorepo tag
2. re-derive telegram-blue CSS anchors from the new app.asar
3. bump/verify the multiverse rev + `pin` version

## 2. plugins

four plugins, registered in `~/.config/opencode/opencode.json`:

```json
"plugins": [
  { "package": "/home/<you>/projects/opencode-claude-memory", "options": {} },
  { "package": "/home/<you>/projects/opencode-zai-quota",     "options": {} },
  { "package": "/home/<you>/projects/opencode-taskmon",       "options": {} },
  { "package": "/home/<you>/projects/opencode-session-log",   "options": {} }
]
```

canonical copies live in `plugins/` (source mirrors of `~/projects/<name>`).
install: copy the dir wherever you keep plugins, then:

```sh
rsync -a plugins/opencode-zai-quota/ ~/projects/opencode-zai-quota/
cd ~/projects/opencode-zai-quota && bun install && bun run build   # dist/ is included, so this is optional
```

| plugin | what it does | needs |
|---|---|---|
| opencode-claude-memory | claude-code-style auto memory (see section 5) | nothing extra; ships prebuilt `dist/` (patched npm-package copy) |
| opencode-zai-quota | z.ai + openrouter usage pills, `glm_quota`/`openrouter_usage` tools | bun |
| opencode-taskmon | long-job progress pills | `taskmon` CLI on PATH (section 3), `jq` |
| opencode-session-log | JSONL log of concurrent-session count changes | nothing extra |

## 3. widgets (composer pills)

- **z.ai pill** + **openrouter pill** - part of `opencode-zai-quota`
  (`src/gui.tsx`): quota windows with red/amber thresholds, dropdown rows,
  retry every 10s on failure, keeps last-good values instead of `?`
- **taskmon pill** - part of `opencode-taskmon`; driven by the `taskmon` CLI:
  ```sh
  cp plugins/opencode-taskmon/scripts/taskmon ~/.local/bin/taskmon   # needs jq
  ```
  jobs are JSON files in `~/.local/state/taskmon/<id>.json`; usage rules for
  the model live in `~/.config/opencode/AGENTS.md` (taskmon section)
- **spinner verbs** - NOT a plugin, comes from `patches/spinner-verbs.patch`
  (section 1). the standalone plugin in `~/projects/opencode-spinner-verbs` is
  the unregistered historical fallback, not needed

## 4. mcp servers

the `mcp` block in `~/.config/opencode/opencode.json` (paths to taste):

```json
{
  "nixos":             { "type": "local", "command": ["uvx", "mcp-nixos"] },
  "playwright":        { "type": "local", "command": ["nix", "run", "nixpkgs#playwright-mcp"] },
  "mermaid":           { "type": "local", "command": ["nix", "shell", "nixpkgs#nodejs", "-c", "npx", "-y", "@peng-shawn/mermaid-mcp-server"],
                         "environment": { "PUPPETEER_EXECUTABLE_PATH": "/run/current-system/sw/bin/chromium",
                                          "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD": "true" } },
  "claudecodebrowser": { "type": "local", "command": ["python3", "<home>/.claudecodebrowser/mcp-server/stdio_wrapper.py"] },
  "ghidra":            { "type": "local", "command": ["<home>/.local/bin/bridge-mcp-ghidra"] }
}
```

prerequisites:
- `nixos` - [uv](https://docs.astral.sh/uv/) (`uvx` fetches mcp-nixos on first run)
- `playwright` - nix; non-nix: `npm i -g @playwright/mcp` or equivalent
- `mermaid` - chromium on PATH at the `PUPPETEER_EXECUTABLE_PATH` above, download skipped
- `claudecodebrowser` - partial extension build wired to the Zen browser (~21/39 tools
  work); the `stdio_wrapper.py` + `server.py` tree lives in `~/.claudecodebrowser/`
  on the reference machine, not in this repo. optional - drop the block if unwanted
- `ghidra` - `uv tool install ghidra-mcp-bridge` (v6.0.0), needs a running ghidra instance

## 5. memory setup (config only, not the memories)

- plugin: `plugins/opencode-claude-memory` - a patched copy of the
  opencode-claude-memory npm package; the patch delays deletion of memory
  fork sessions by 10 min, which fixes "Session not found" toasts in the
  desktop app
- store: `~/.claude/projects/<munged-project-path>/memory/` - one markdown
  file per memory with frontmatter (`name`, `description`, `type`), indexed
  by `MEMORY.md`. claude code reads/writes the same store, so both agents
  share one memory per project
- behavior: extraction runs on idle, consolidation every 24h; save/recall
  trigger rules are the "Auto memory" section of `~/.config/opencode/AGENTS.md`
- nothing else to configure - first run creates the store directory

## 6. tools + commands

- `glm_quota` / `openrouter_usage` tools - provided by the `opencode-zai-quota`
  plugin (section 2), no extra install
- slash commands `/glm_quota`, `/openrouter_usage` - copy from a reference
  `~/.config/opencode/command/`:
  ```sh
  cp command/*.md ~/.config/opencode/command/
  ```
  (not vendored here yet - plain wrapper scripts calling the tools)
- credentials: z.ai coding plan key lives in opencode auth storage
  (`~/.local/share/opencode/opencode.db`); the openrouter key is read from
  the claude-code-router config (`~/.claude-code-router/config.json`), NOT
  from opencode

## 7. keeping the mirrors in sync

`plugins/` here mirrors `~/projects/<name>` on the reference machine. after
changing a plugin locally:

```sh
rsync -a --exclude node_modules ~/projects/opencode-zai-quota/ plugins/opencode-zai-quota/
git add plugins && git commit -m "sync opencode-zai-quota" && git push
```
