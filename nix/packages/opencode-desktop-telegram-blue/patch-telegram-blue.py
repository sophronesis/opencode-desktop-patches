#!/usr/bin/env python3
"""Telegram-blue user message bubbles for the opencode desktop app.

The desktop app hard-codes the user bubble color to the fixed v2 design token
`--v2-background-bg-layer-02` (a grey). The color is NOT theme-controlled -
no theme JSON can change it - so we patch the compiled CSS inside app.asar
directly, in place, with SAME-LENGTH byte edits. The asar stores its files
back-to-back with offsets in the header, so any length change would corrupt
everything after the edit; trailing whitespace inside a CSS declaration is
free padding.

Patched (opencode-desktop 2.2.1, all anchors verified unique in that bundle):
  1. delivered bubble bg:   var(--v2-background-bg-layer-02) -> #2b5278
  2. :root body override bg (same token, wins the cascade)
  3. pending (queued/steering) bubble: layer-01 -> #2b5278, muted text -> base
  4. @file/@agent highlight inside the bubble: accent blue -> #aecbfa
     (otherwise blue-on-blue against the new bubble)
  5. mention prefix: same treatment

Usage: patch-telegram-blue.py <app.asar> <wrapper-bin> <old-store-path> <new-store-path>
"""

import sys

BUBBLE = b"#2b5278"  # telegram dark outgoing bubble
HIGHLIGHT = b"#aecbfa"  # light blue for mentions/links inside the bubble


def pad(value: bytes, target: int) -> bytes:
    assert len(value) <= target
    return value + b" " * (target - len(value))


def check(old: bytes, new: bytes) -> None:
    assert len(old) == len(new), f"length mismatch: {len(old)} != {len(new)}\n  old: {old!r}\n  new: {new!r}"


def main() -> None:
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    asar, wrapper, old_path, new_path = (a.encode() for a in sys.argv[1:5])
    if len(old_path) != len(new_path):
        sys.exit(
            f"wrapper patch needs same-length store paths (identical package name): "
            f"{old_path!r} vs {new_path!r}"
        )

    layer02 = b"var(--v2-background-bg-layer-02)"  # 33 bytes
    layer01 = b"var(--v2-background-bg-layer-01)"  # 33 bytes
    accent = b"var(--v2-text-text-accent)"  # 26 bytes

    replacements = [
        # 1. main rule (transcript bubble)
        (
            b"[data-slot=user-message-text]{white-space:pre-wrap;word-break:break-word;background:"
            + layer02,
            b"[data-slot=user-message-text]{white-space:pre-wrap;word-break:break-word;background:"
            + pad(BUBBLE, len(layer02)),
        ),
        # 2. :root body override (wins the cascade)
        (
            b"[data-component=user-message] [data-slot=user-message-text]{background:"
            + layer02
            + b";color:var(--v2-text-text-base)}",
            b"[data-component=user-message] [data-slot=user-message-text]{background:"
            + pad(BUBBLE, len(layer02))
            + b";color:var(--v2-text-text-base)}",
        ),
        # 3. pending (queued/steering) bubble - telegram keeps these blue too
        (
            b"[data-component=user-message][data-pending] [data-slot=user-message-text]{background:"
            + layer01
            + b";color:var(--v2-text-text-muted)",
            b"[data-component=user-message][data-pending] [data-slot=user-message-text]{background:"
            + pad(BUBBLE, len(layer01))
            + b";color:var(--v2-text-text-base) ",
        ),
        # 4. @file / @agent highlights inside the user bubble
        (
            b"[data-highlight=file],[data-component=user-message] [data-slot=user-message-text] "
            b"[data-highlight=agent]{color:" + accent + b";direction",
            b"[data-highlight=file],[data-component=user-message] [data-slot=user-message-text] "
            b"[data-highlight=agent]{color:" + pad(HIGHLIGHT, len(accent)) + b";direction",
        ),
        # 5. mention prefix inside the user bubble
        (
            b"[data-component=user-message] [data-slot=user-message-text] "
            b"[data-slot=user-message-mention-prefix]{color:" + accent + b"}",
            b"[data-component=user-message] [data-slot=user-message-text] "
            b"[data-slot=user-message-mention-prefix]{color:" + pad(HIGHLIGHT, len(accent)) + b"}",
        ),
    ]

    for old, new in replacements:
        check(old, new)

    data = open(asar, "rb").read()
    for i, (old, new) in enumerate(replacements, 1):
        n = data.count(old)
        if n != 1:
            sys.exit(f"anchor {i} found {n}x (expected 1) in {asar} - upstream CSS changed? "
                     f"re-derive the anchors for this version:\n  {old[:90]!r}")
        data = data.replace(old, new)
    open(asar, "wb").write(data)
    print(f"patched {asar}: {len(replacements)} CSS anchors -> telegram blue")

    wdata = open(wrapper, "rb").read()
    n = wdata.count(old_path)
    if n == 0:
        sys.exit(f"store path not found in wrapper {wrapper} - wrapper format changed?")
    open(wrapper, "wb").write(wdata.replace(old_path, new_path))
    print(f"patched {wrapper}: {n}x self-reference -> {new_path.decode()}")


if __name__ == "__main__":
    main()
