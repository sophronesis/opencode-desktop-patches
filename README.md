# opencode-desktop-patches

Source patches against the [opencode](https://github.com/anomalyco/opencode)
desktop monorepo, plus the full plugin/widget/MCP setup that runs on top of
it - see [INSTALL.md](INSTALL.md) for the complete install guide and
`plugins/` for the four opencode plugins. Base: tag **v2.2.1**. Apply from the monorepo root:

```sh
git apply --check patches/generic-tool-expandable.patch   # verify first
git apply patches/generic-tool-expandable.patch
git apply patches/spinner-verbs.patch
```

or with plain `patch -p1`. Rebase against the new tag on every opencode
version bump - both touch renderer code that moves.

## generic-tool-expandable.patch

Plugin and MCP tool calls (anything without a registered renderer - e.g.
memory_save, taskmon) fall back to `GenericTool`, which shows only
"Called \<tool\>" plus up to three key=value args and has **no expandable
body**: the full input and output are invisible. This patch gives
`GenericTool` a collapsible body with the complete input record and the
tool's text output.

- file: `packages/session-ui/src/components/basic-tool.tsx`

## spinner-verbs.patch

Replaces the built-in "Working" busy labels with rotating Claude Code-style
spinner verbs:

- timeline status line: `<TextShimmer text={spinnerVerb()} />` instead of
  `language.t("session.timeline.working")`
- sidebar inbox rows: `Vibecoding 12s` instead of `Working {{duration}}`
  (verbs truncated to 20 chars)

The verb rotates every 8s via a module-level tick signal. `createSpinnerVerb()`
gives every call site its own random salt mixed into the tick counter
(multiplicative hash), so the timeline and each sidebar row show **different**
verbs while all of them rotate together per 8s window. The salt is picked at
mount, not per render: the inbox row re-renders every second for the elapsed
counter, so per-render randomness would flicker.

- files: `packages/app/src/session/spinner-verbs.ts` (new, 109 verbs verbatim
  from [Castrozan's spinner-verbs.nix](https://github.com/Castrozan/.dotfiles/blob/main/agent-harness/harnesses/claude-code/settings/spinner-verbs.nix)),
  `packages/app/src/session/timeline/message-timeline.tsx`,
  `packages/app/src/shell/titlebar/inbox.tsx`

## Not here

A third opencode-desktop modification - telegram-blue user message bubbles -
lives in the [nixos config](https://github.com/sophronesis/nixos)
(`packages/opencode-desktop-generic-tool`, `packages/opencode-desktop-telegram-blue`)
because it byte-patches the built `app.asar` at build time and is not a
source patch.

## Usage in nix

The nixos config wires these as `overrideAttrs patches` on the nixpkgs
`opencode-desktop` 2.2.1 derivation, chained with the telegram-blue asar
wrapper. See `package.nix` in the config repo for the wiring.
