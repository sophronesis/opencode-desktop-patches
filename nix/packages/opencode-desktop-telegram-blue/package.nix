# OpenCode desktop app with Telegram-blue user message bubbles.
#
# Mirror of the nixos config's packages/opencode-desktop-telegram-blue
# (github.com/sophronesis/nixos).
#
# The desktop app's user bubble color is hard-coded compiled CSS
# (`--v2-background-bg-layer-02`, a grey) - it is NOT derived from the
# selected theme, so no theme JSON can change it. This copies the pinned
# package and patches the CSS inside app.asar in place (same-length byte
# edits, see patch-telegram-blue.py). The bin/ C-wrapper embeds its own
# store path, which we rewrite to the copy - that only works because the
# derivation keeps the SAME NAME as the base package (same store path
# length). Don't rename it.
#
# 2026/11/12: created for opencode-desktop 2.2.1 (the multiverse pin).
# On a version bump the CSS anchors may shift - the patch script asserts
# on every anchor and fails the build loudly instead of corrupting the
# asar. Re-derive anchors from the new app.asar then.
{
  lib,
  runCommand,
  python3,
  opencode-desktop,
}:

runCommand opencode-desktop.name {
  nativeBuildInputs = [ python3 ];
  meta = opencode-desktop.meta or { };
} ''
  cp --reflink=auto -r ${opencode-desktop}/ $out
  chmod -R u+w $out

  python3 ${./patch-telegram-blue.py} \
    "$out/opt/opencode-desktop/resources/app.asar" \
    "$out/bin/opencode-desktop" \
    "${opencode-desktop}" \
    "$out"
''
