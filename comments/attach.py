#!/usr/bin/env python3
"""Make sure every HTML page in this site loads the reading-comments feature.

Course pages are replaced by uploads, which drop anything added to them by hand. This
script puts back the one line that loads comments/comments.js, just before </body>.
It is run by .github/workflows/keep-comments.yml after every push, and can be run by
hand: python3 comments/attach.py. Pages that already have the line are left untouched.
"""
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "comments" / "comments.js"
MARK = b"data-lpa-comments"


def attach(page: pathlib.Path) -> bool:
    data = page.read_bytes()
    if MARK in data:
        return False
    rel = os.path.relpath(SCRIPT, page.parent).replace(os.sep, "/")
    rel = rel.replace(" ", "%20")
    tag = b'<script src="' + rel.encode() + b'" defer data-lpa-comments></script>'
    at = data.lower().rfind(b"</body>")
    if at == -1:
        data = data.rstrip(b"\r\n") + b"\n" + tag + b"\n"
    else:
        nl = b"\r\n" if b"\r\n" in data[:4096] else b"\n"
        data = data[:at] + tag + nl + data[at:]
    page.write_bytes(data)
    return True


def main() -> int:
    changed = []
    for page in sorted(ROOT.rglob("*.html")):
        if ".git" in page.parts or "node_modules" in page.parts:
            continue
        if attach(page):
            changed.append(page.relative_to(ROOT).as_posix())
    for p in changed:
        print("attached:", p)
    print(f"{len(changed)} page(s) updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
