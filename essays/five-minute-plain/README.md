# Essays in five minutes: plain-words layer

The source of three things on `essays/five-minute.html`:

- **The 30-second outline** at the top of each essay card (what the statement says,
  your answer, three steps, one line to remember), and a short "How to spot it".
- **The quick check**: three easy questions per card (137 in all).
- **The harder quiz** at the end of each family (Q1–Q5): 70 items, mostly hypos and
  reworded statements. After picking the essay, the reader gives a verdict: agree,
  partly agree or disagree, or a vote on each part of a bill.

The original card content (exam question, full route, hypo, harder questions) is kept,
folded under "Go deeper". The original quiz bank is still there as "Spot the essay only".

## Files

- `cards/*.txt`: one `@card E1` block per card. Lines: `say:`, `verdict:` (`agree`,
  `mostly`, `partly`, `disagree`, or `other:Your label`), `answer:`, `step:` (three),
  `remember:`, `spot:`, then the questions: `Q:` question, `*` right option, `-` wrong
  option, each followed by ` || ` and the explanation shown after answering.
- `quiz/hard.txt`: one `@item` block per quiz item: `kind:` (`hypo`, `twist` or `g1`),
  `best:`, `also:` (half marks), `src:`, `Q:`, `why:`, `trap: E5 || why not`, and one or
  more `part: question || options || number of the right one || why`. Options are
  `@vote`, `@stance`, `@right`, or your own `A | B | C` (their order is shuffled).
- `qz.js`: the quiz engine with the verdict step. It replaces the page's own engine once.
- `apply.py`: puts all of this into the page.

## After editing, or after uploading a new five-minute.html

```
python3 essays/five-minute-plain/apply.py
python3 comments/attach.py
```

It can be run any number of times: it replaces what it added before and folds the
original card content away only once.
