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

## LAW302 hypo quick checks and the section timer: re-apply after uploads

The quick checks inside the LAW302 hypo pages of `practice.html` come from
`law302/hypo-quick-checks/`, and the section timer is `timer/timer.js` (never delete it).
If an upload replaces `practice.html` with a version without them (the J1 page kicker
says "8 QUESTIONS", or there is no `data-lpa-timer` script line), run
`python3 law302/hypo-quick-checks/apply.py` and then `python3 comments/attach.py`.

## LAW302 Meta Game hypos page: built elsewhere, keep its page ids

`meta-game/index.html` and `1-order-rounds.html` (the Order Rounds drill) come from `Meta Game/Drill Prototypes/src/build.py --site <this checkout>`;
`meta-game/study.html` (Notes and answers) from `src/meta/build_page.py --site <this checkout>`
(source data in `src/meta/work/`). It is not part of the course upload, so an upload leaves it alone. It loads
`../comments/comments.js` like every page (study.html only); its page ids are `mg-<hypo id>` (e.g. `mg-q1-10`), `home`, `mistakes`,
`plans` and `sources`. Don't rename them: reading comments are keyed by them. Its sidebar link in `index.html` and
`practice.html` (after "Block test · Conflict") is added by `src/meta/site_patch.py`; re-run it after an upload of
those two files if the link is gone.

mx-10 to mx-13 (added 21 November 2026) are Mixed hypos at the length of one question of the final: 600 to 850 words,
12 to 16 boxes, one twist, `"exam": true` in the bank file. Their rules are in `src/BRIEF-exam.md`; after a law review,
`src/meta/finalize_exam.py <id>` copies `src/meta/work/<id>/hypo.json` into the bank. The hypo count on the
`law302/index.html` card and in `README.md` is typed by hand: update both when hypos are added.

## LAW302 Exam Day Sim: built elsewhere

`law302/exam-day-sim/hypo-N.html` are single-file pages built by `Meta Game/Drill Prototypes/Exam Day Sim/src/build.py <hypo id>`
(numbering in its `NUMBER` table); copy each `Exam Day Sim - Hypo N (...).html` over `hypo-N.html` after a rebuild, which is needed
whenever the LAW302 Menu changes, because each page embeds the Menu as printed. `index.html` there is the list. The pages keep
their state in localStorage under `examsim:<hypo id>`. They are not part of the course upload. Each page also embeds the
Archetypes booklet as printed (rebuild after `render_archetypes.sh` too) and a time budget per part from `src/timing.py`.
`index.html` is written by `src/site_index.py <this checkout>/law302/exam-day-sim/index.html`; `primer.html` (the
Archetype Primer, listed first) is `Exam Day Sim/Archetype Primer.html` from `src/primer/primer.py`.
