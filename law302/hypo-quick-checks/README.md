# LAW302 hypo quick checks

The source of the "Quick check" questions inside the LAW302 hypo pages of
`practice.html` (J1–J7, C1–C3): 285 questions, one check after each section and
at sub-section breaks in long sections, as the LAW301 hypo pages have.

- `questions/hj1.txt` … `hc3.txt`: one file per page. `@sec <heading id>` starts a
  check placed at the end of that section; `@sec <page id>::<heading text>` does the
  same for a sub-heading without an id. `Q:` question, `H:` hint, `*` right option,
  `-` wrong option, each followed by ` || ` and the explanation shown after checking.
- `questions/zfix.txt`: shorter or longer option texts for the original 80 hypo-test
  questions, so the right answer is no longer simply the longest option.
- `apply.py`: adds all of this to a `practice.html` that does not have it yet.

Option lengths are balanced (the right answer is the longest option in about a
quarter of questions), and `apply.py` spreads the right answer evenly over A–D.

If a newly uploaded `practice.html` replaces the one with the quick checks, run:

```
python3 law302/hypo-quick-checks/apply.py
python3 comments/attach.py
```

It stops without changing anything if the questions are already there.
