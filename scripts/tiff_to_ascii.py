#!/usr/bin/env python3
"""Convert Obito TIFF to ASCII art for the CLI banner."""

import sys
from pathlib import Path

def convert(tiff_path: str, width: int = 60, height: int = 25) -> str:
    try:
        from PIL import Image
    except ImportError:
        print("Run: pip3 install Pillow", file=sys.stderr)
        sys.exit(1)

    img = Image.open(tiff_path).convert("L")

    # Correct for terminal character aspect ratio (~0.45 width:height)
    aspect = img.height / img.width
    new_h = int(width * aspect * 0.45)
    img = img.resize((width, new_h if new_h > 0 else height))

    # Dense-to-sparse ramp (dark bg: spaces = bright, chars = dark)
    chars = "@%#*+=-:. "

    lines = []
    for y in range(img.height):
        row = ""
        for x in range(img.width):
            pixel = img.getpixel((x, y))
            row += chars[int(pixel / 256 * len(chars))]
        lines.append(row)
    return "\n".join(lines)


if __name__ == "__main__":
    tiff = sys.argv[1] if len(sys.argv) > 1 else "obito_uchiha_by_tanyungfx_dl3uoau.tiff"
    width = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    result = convert(tiff, width)
    print(result)

    # Also write to file for embedding
    out = Path(tiff).with_suffix(".ascii.txt")
    out.write_text(result)
    print(f"\n→ saved to {out}", file=sys.stderr)
