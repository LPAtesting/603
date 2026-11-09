# Notes for anyone (human or Claude) updating this site

## Reading comments are a permanent feature: keep them

`comments/` holds the Notion-style comments feature (select text → Comment → the comment
shows on the right, level with the text). It is separate from the course content on purpose.

- Never delete or overwrite `comments/comments.js`, `comments/attach.py` or
  `.github/workflows/keep-comments.yml` when updating course material.
- Every HTML page must load the feature with this line just before `</body>`
  (the path is relative to the page):
  `<script src="comments/comments.js" defer data-lpa-comments></script>`
- When you replace or add HTML pages, run `python3 comments/attach.py` before committing.
  It adds the line wherever it is missing and leaves other pages alone. If you forget,
  the "Keep comments attached" GitHub Action does it automatically after the push.
- Comments are stored in the reader's browser (localStorage key `lpa-comments-v1`) and in
  a secret gist (`lpa-lessons-comments.json`), keyed by page id (e.g. `/603/#law302-j1`)
  and anchored by quoted text. Don't rename page ids (`<article class="page" id="...">`)
  without a reason: comments on a renamed page show under "All pages" with the old id.
