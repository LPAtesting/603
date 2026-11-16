# LAW301 + LAW302 Lessons, Hypos, Block Tests and Games

Each course has four things, and the pages link to each other:

- `index.html`: the lessons. LAW302 Conflict of Laws (pre-writes 00, J1–J7, C1–C3) and LAW301 Legal Theory (exam-sheet archetypes 2–12), with 83 flowcharts and 630 multiple-choice questions.
- `practice.html`: the hypotheticals. LAW302's J and C hypotheticals (rule, facts, application) with their flowcharts, and the LAW301 hypo lessons 1–16, with their questions.
- `block-test/conflict.html`: the LAW302 block test. Pick the best 3 pre-write blocks, 69 questions on the mock final hypos.
- `block-test/ltp/`: the LAW301 block test. Pick the best 3 sheet blocks, on the 60 mock exam questions.
- `games/`: two playable revision games, The Forum Machine (LAW302) and The Ought Machine (LAW301), with a page to choose between them.

## Updating the site

The site is live at <https://lpatesting.github.io/603/>.

1. Open <https://github.com/LPAtesting/603> and click **Add file → Upload files**.
2. Open the upload folder and select everything in it (`index.html`, `practice.html`, `README.md`, `block-test` and `games`). Drag them in together and click **Commit changes**. Drag what is inside the folder, not the folder itself, and keep `block-test` and `games` as folders.
3. The changes go live after a minute or two.

An upload replaces only the files with the same names. Leave `comments/`, `timer/`, `.github/`, `CLAUDE.md`, `law302/` and `LPA 603 upload/` where they are. They are not part of the upload, and the comments feature depends on the first two.

On the lessons or hypo page, press `?` for the keyboard shortcuts (`/` search, `[` `]` lessons).

**Saving progress.** Answers are kept in your browser. Press `G` (or the Save button) and paste a GitHub token with only the `gist` scope to save them to a secret gist in your own account, so they follow you to any computer. Both pages use the same token and the same gist (one file each). Game progress is separate: it stays in the browser you play on. The token is stored only in your browser and sent only to api.github.com. A backup file option needs no account.

**Section timer.** On the hypo page, every section that ends in a quick check is timed while you read or answer it (time stops after 3 minutes without activity or when the tab is hidden). The ⏱ button in the top bar shows the current section's time; each section heading shows its time or estimate; finishing a quiz shows how long that section took and the updated time left for the page, the course and everything; the end of each page has a table of its sections, and the home page shows the time left per course and lesson. Estimates start at 170 words a minute and 1 minute a question and adjust to your own pace. Timings are kept in your browser and, if you use Save, in the same secret gist as your answers. After uploading a new `practice.html`, run `python3 law302/hypo-quick-checks/apply.py` to put back the LAW302 quick checks and the timer.

**Essays in five minutes.** Each essay card on `essays/five-minute.html` opens with a 30-second outline in plain words and ends with three easy questions; each family ends with a harder quiz, mostly hypos, where you also give your verdict or vote. This layer comes from `essays/five-minute-plain/`. After uploading a new `essays/five-minute.html`, run `python3 essays/five-minute-plain/apply.py` to put it back.

**Comments while you read.** Select any text and press **Comment**, double-click inside the selection, or press Ctrl/⌘+Shift+M. The text is highlighted and your comment appears on the right, beside it, with replies, edit, delete and resolve. The 💬 Comments button lists every comment on every page. Comments are kept in your browser and, if you've connected a token with Save, in a secret gist on your GitHub account. They are never stored in the lesson files, so uploading new course material doesn't remove them. The `comments/` folder and the "Keep comments attached" GitHub Action keep the feature on every page after each upload.
