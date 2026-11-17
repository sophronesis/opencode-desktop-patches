# OpenCode desktop app with expandable generic tool-call rows.
#
# Mirror of the nixos config's packages/opencode-desktop-generic-tool
# (github.com/sophronesis/nixos); patch paths point at this repo's patches/.
#
# Plugin/MCP tools (memory_save, taskmon, anything without a registered
# renderer) fall back to GenericTool, which shows only "Called <tool>" plus
# up to three key=value args and has NO expandable body - the full input and
# output are invisible (this is why memory_save contents could not be read
# from the desktop app). This patches GenericTool to grow a collapsible body
# with the complete input record and the tool's text output, capped at
# max-h-72 with internal scrolling.
#
# Base resolution: the config's `pin "opencode-desktop" "latest"` returns a
# multiverse FAKE derivation (outPath only, no overrideAttrs), so it cannot
# take source patches. Multiverse embeds the real nixpkgs derivation under
# `.eval`, which is what we patch instead. That pins this package to the
# multiverse rev below AND to version 2.2.1 - on `nix flake update
# nixpkgs-multiverse`, or on any deliberate version bump, re-check:
#   1. the rev still exists (or bump it to the new lock rev)
#   2. "2.2.1" is still the version `pin "opencode-desktop" "latest"` gives
#   3. rebase ./generic-tool-expandable.patch against the new monorepo tag
#   4. re-derive the telegram-blue CSS anchors (its script asserts loudly)
#
# Source patch is against the opencode monorepo (packages/session-ui), so it
# rides in the package's `patches` list and must be rebased on version bumps
# like any nixpkgs patch. esbuild parses the result; the real check is the
# electron-vite build in the desktop derivation itself.
#
# Wire it BEFORE the telegram-blue wrapper so the wrapper patches the
# rebuilt app.asar. The derivation keeps the SAME NAME
# (opencode-desktop-2.2.1), so the wrapper's same-length store-path rewrite
# keeps working.
#
# 2026/11/13: created against opencode-desktop 2.2.1 (monorepo tag v2.2.1),
# multiverse rev 390f52c4d0f49772ef625e0f8352030e31b40a7b (config lock).
_:

let
  multiverse = builtins.getFlake "github:fzakaria/nixpkgs-multiverse/390f52c4d0f49772ef625e0f8352030e31b40a7b";
  opencode-desktop = multiverse.multiverse.x86_64-linux.fast.versions.opencode-desktop."2.2.1".eval;
in
opencode-desktop.overrideAttrs (old: {
  patches = (old.patches or [ ]) ++ [
    ../../patches/generic-tool-expandable.patch
    # spinner verbs: replaces the built-in "Working" labels (timeline status
    # line + inbox rows) with rotating Claude Code-style verbs from
    # Castrozan/.dotfiles spinner-verbs.nix. rebases like the patch above on
    # version bumps.
    ../../patches/spinner-verbs.patch
  ];
})
