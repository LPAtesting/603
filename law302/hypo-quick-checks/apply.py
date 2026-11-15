"""Re-apply the LAW302 hypo quick checks to practice.html.

Usage:  python3 law302/hypo-quick-checks/apply.py [path/to/practice.html]

Reads the question files in questions/ (one per hypo page, plus zfix.txt, which
rebalances the option lengths of the original 80 hypo-test questions), adds the
questions to window.QBANK, puts a "Quick check" after each listed section, and
updates the question counts. Run it after uploading a practice.html that does not
have the quick checks yet. It does nothing if they are already there.
"""
import re, json, hashlib, html, sys, glob, os, random
NEWCOUNT = 0
from collections import Counter, defaultdict
SP = os.path.dirname(os.path.abspath(__file__))
TARGET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SP, '..', '..', 'practice.html')
s = open(TARGET, encoding='utf-8').read()

PAGES = {  # pid: (lesson, code)
 'law302-hj1': ('302:101', 'J1'), 'law302-hj2': ('302:102', 'J2'), 'law302-hj3': ('302:103', 'J3'),
 'law302-hj4': ('302:104', 'J4'), 'law302-hj5': ('302:105', 'J5'), 'law302-hj6': ('302:106', 'J6'),
 'law302-hj7': ('302:107', 'J7'), 'law302-hc1': ('302:108', 'C1'), 'law302-hc2': ('302:109', 'C2'),
 'law302-hc3': ('302:110', 'C3')}

# acronym -> title, taken from the page itself so new questions match old ones
amap = defaultdict(Counter)
for a, t in re.findall(r'<abbr title="([^"]*)">([^<]*)</abbr>', s):
    amap[t][a] += 1
SKIP = {'CA', 'HC', 'GD', 'IP', 'C&amp;Y', 'LLP'}
ABBR = {k: c.most_common(1)[0][0] for k, c in amap.items() if k not in SKIP}
abbr_re = re.compile(r'(?<![\w&;>])(' + '|'.join(sorted(map(re.escape, ABBR), key=len, reverse=True)) + r')(?=s?\b)')

def fmt(t):
    t = html.escape(t.strip(), quote=False)
    t = abbr_re.sub(lambda m: '<abbr title="%s">%s</abbr>' % (ABBR[m.group(1)], m.group(1)), t)
    return t

def parse(path):
    """Compact format:
    @sec <section h2 id>      (new quick check after that section)
    @fix <existing question id>  (replace the option texts of an existing question)
    Q: question   H: hint   * correct || why   - wrong || why"""
    blocks = []; cur = None; q = None
    for ln in open(path, encoding='utf-8'):
        ln = ln.rstrip('\n')
        if not ln.strip() or ln.startswith('#'): continue
        if ln.startswith('@sec ') or ln.startswith('@fix '):
            cur = {'kind': ln[1:4], 'key': ln[5:].strip(), 'qs': []}; blocks.append(cur); q = None
            if cur['kind'] == 'fix': q = {'q': None, 'hint': None, 'opts': []}; cur['qs'].append(q)
        elif ln.startswith('Q: '):
            q = {'q': ln[3:], 'hint': None, 'opts': []}; cur['qs'].append(q)
        elif ln.startswith('H: '):
            q['hint'] = ln[3:]
        elif cur and cur['kind'] == 'fix' and re.match(r'^[0-3]: ', ln):
            q.setdefault('ts', {})[int(ln[0])] = ln[3:]
        elif ln[:2] in ('* ', '- '):
            t, _, why = ln[2:].partition(' || ')
            if not why: sys.exit('missing why: ' + ln)
            q['opts'].append({'t': t, 'why': why, 'ok': ln[0] == '*'})
        else:
            sys.exit('bad line in %s: %s' % (path, ln))
    return blocks

i = s.find('window.QBANK=') + len('window.QBANK=')
qb, end = json.JSONDecoder().raw_decode(s, i)
new_ids = defaultdict(list)   # section id -> ids
per_page = Counter()
problems = []
for path in sorted(glob.glob(os.path.join(SP, 'questions', '*.txt'))):
    for b in parse(path):
        if b['kind'] == 'fix':
            if b['key'] not in qb: print('skip fix, no such question:', b['key']); continue
            old = qb[b['key']]; q = b['qs'][0]
            for n, t in q.get('ts', {}).items():
                old['opts'][n]['t'] = fmt(t)
            if q.get('ts') and not q['opts']:
                continue
            if q['q']: old['q'] = fmt(q['q'])
            if q['hint']: old['hint'] = fmt(q['hint'])
            if len(q['opts']) != len(old['opts']): sys.exit('fix opt count ' + b['key'])
            oldok = [o['ok'] for o in old['opts']]
            if q['opts'] and [o['ok'] for o in q['opts']] != oldok:
                # allow reordering: take the new order as given
                pass
            old['opts'] = [{'t': fmt(o['t']), 'why': fmt(o['why']), 'ok': o['ok']} for o in q['opts']]
            continue
        sec = b['key']
        pid = re.split('--|::', sec)[0]
        lesson, code = PAGES[pid]
        for q in b['qs']:
            # spread the right answer evenly over A-D: within each run of four
            # questions every position is used once, in a shuffled order
            k = NEWCOUNT; NEWCOUNT += 1
            perm = [0, 1, 2, 3]; random.Random(k // 4 * 7919 + 17).shuffle(perm)
            target = perm[k % 4]
            right = [o for o in q['opts'] if o['ok']]; wrong = [o for o in q['opts'] if not o['ok']]
            if len(right) == 1 and len(wrong) == 3:
                q['opts'] = wrong[:target] + right + wrong[target:]
            oks = [o['ok'] for o in q['opts']]
            if len(q['opts']) != 4 or oks.count(True) != 1:
                sys.exit('need 4 opts / 1 correct: ' + q['q'])
            qid = '%sq-%s' % (code.lower(), hashlib.md5(q['q'].encode()).hexdigest()[:8])
            if qid in qb: sys.exit('Quick checks are already in this file (found %s). Nothing to do.' % qid)
            qb[qid] = {'id': qid, 'lesson': lesson, 'level': code + ' · HYPO', 'q': fmt(q['q']),
                       'hint': fmt(q['hint'] or ''), 'opts': [{'t': fmt(o['t']), 'why': fmt(o['why']), 'ok': o['ok']} for o in q['opts']],
                       'course': '302'}
            if not q['hint']: del qb[qid]['hint']; qb[qid]['hint'] = ''
            new_ids[sec].append(qid); per_page[pid] += 1

# keep key order of the original qbank entries (id, lesson, level, q, hint, opts, course)
qbs = json.dumps(qb, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
out = s[:i] + qbs + s[end:]

QUIZ = '<div class="quiz" data-kind="quiz" data-title="Quick check" data-ids="%s"><noscript>Turn on JavaScript to use the quiz.</noscript></div>\n'
for pid in PAGES:
    st = out.find('<article class="page" id="%s"' % pid); en = out.find('</article>', st)
    seg = out[st:en]
    heads = [(m.start(), m.group(1), m.group(2)) for m in re.finditer(r'<(h2) class="sec" id="([^"]+)"', seg)]
    heads = [(p, lv, i) for p, lv, i in heads]
    subs = [(m.start(), 'h3', m.group(1)) for m in re.finditer(r'<h3 class="sub" id="([^"]+)"', seg)]
    # sub-headings without an id are addressed as "<pid>::<start of heading text>"
    for m in re.finditer(r'<h3 class="sub">(.*?)</h3>', seg):
        t = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
        for sid in new_ids:
            if sid.startswith(pid + '::') and t.startswith(sid.split('::', 1)[1]):
                subs.append((m.start(), 'h3x', sid))
    allh = sorted(heads + subs)
    test = seg.find('<div class="quiz" data-kind="test"')
    ins = []
    for k, (p, lv, hid) in enumerate(allh):
        if new_ids.get(hid):
            if lv == 'h3x':
                nxt = [m.start() for m in re.finditer(r'<h[23] class="s', seg) if m.start() > p]
                at = nxt[0] if nxt else test
                ins.append((at, QUIZ % ','.join(new_ids[hid]))); continue
            later = [q for q in allh[k + 1:] if q[1] == 'h2' or (lv == 'h3' and q[1] == 'h3')]
            at = later[0][0] if later else test
            ins.append((at, QUIZ % ','.join(new_ids[hid])))
    for sid in new_ids:
        if (sid.startswith(pid + '--') or sid.startswith(pid + '::')) and sid not in [h for _, _, h in allh]: sys.exit('unknown section ' + sid)
    for at, txt in sorted(ins, reverse=True):
        seg = seg[:at] + txt + seg[at:]
    n = sum(1 for v in qb.values() if v.get('lesson') == PAGES[pid][0])
    if per_page[pid]:
        seg = re.sub(r'· \d+ QUESTIONS</div>', '· %d QUESTIONS</div>' % n, seg, count=1)
        seg = seg.replace('The hypo test at the end checks you can run the facts yourself.',
                          'A quick check closes each section, and the hypo test at the end checks you can run the facts yourself.', 1)
    out = out[:st] + seg + out[en:]
    # home card
    lesson = PAGES[pid][0]
    out = re.sub(r'(<a class="lcard[^>]*data-lesson="%s"[\s\S]*?class="lc-meta">[^<]*?)\d+ questions' % re.escape(lesson),
                 lambda m: m.group(1) + '%d questions' % n, out, count=1)
total302 = sum(1 for v in qb.values() if v['course'] == '302')
out = re.sub(r'10 hypo lessons · \d+ questions', '10 hypo lessons · %d questions' % total302, out, count=1)
open(TARGET, 'w', encoding='utf-8').write(out)
print('Added %d questions:' % sum(per_page.values()), dict(per_page))

