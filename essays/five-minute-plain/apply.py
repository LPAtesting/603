#!/usr/bin/env python3
"""Put the plain-words outlines, easy quick checks and the harder quiz into
essays/five-minute.html.

Usage:  python3 essays/five-minute-plain/apply.py [path/to/five-minute.html]

Reads cards/*.txt (one block per essay card), quiz/hard.txt (the harder quiz
bank) and qz.js (the quiz engine with the verdict step). Safe to run again:
plain blocks it added before are replaced, the original card content is
folded away only once, and the engine is patched only once. Run it after
editing the text files, or after uploading a new five-minute.html, then run
python3 comments/attach.py.
"""
import html, json, os, random, re, sys, glob

SP = os.path.dirname(os.path.abspath(__file__))
TARGET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SP, '..', 'five-minute.html')
s = open(TARGET, encoding='utf-8').read()
orig = s

def esc(t):
    return html.escape(t.strip(), quote=False)

def die(msg):
    sys.exit('apply.py: ' + msg)

# ---------------------------------------------------------------- read the text files
VERDICT = {'agree': ('Agree', 'agree'), 'mostly': ('Mostly agree', 'agree'),
           'partly': ('Partly agree', 'partly'), 'disagree': ('Disagree', 'disagree')}

def parse_cards():
    cards, cur, q = {}, None, None
    for path in sorted(glob.glob(os.path.join(SP, 'cards', '*.txt'))):
        for n, raw in enumerate(open(path, encoding='utf-8'), 1):
            line = raw.rstrip('\n')
            if not line.strip() or line.startswith('#'):
                continue
            where = '%s:%d' % (os.path.basename(path), n)
            if line.startswith('@card '):
                cid = line.split()[1]
                cur = cards[cid] = {'id': cid, 'steps': [], 'qs': []}
                q = None
                continue
            if cur is None:
                die('text before the first @card at ' + where)
            if line.startswith('Q: '):
                q = {'q': line[3:], 'opts': []}
                cur['qs'].append(q)
            elif line[:2] in ('* ', '- '):
                if q is None:
                    die('option before a question at ' + where)
                text, _, why = line[2:].partition(' || ')
                q['opts'].append((line[0] == '*', text, why))
            else:
                key, _, val = line.partition(': ')
                if key == 'step':
                    cur['steps'].append(val)
                elif key in ('say', 'verdict', 'answer', 'remember', 'spot'):
                    cur[key] = val
                else:
                    die('unknown line at %s: %r' % (where, line[:40]))
    for c in cards.values():
        for k in ('say', 'verdict', 'answer', 'remember', 'spot'):
            if k not in c:
                die('%s has no %s' % (c['id'], k))
        for q in c['qs']:
            if sum(1 for o in q['opts'] if o[0]) != 1:
                die('%s question %r needs exactly one right option' % (c['id'], q['q'][:40]))
    return cards

SETS = {'@vote': ['Vote for', 'Vote against'],
        '@stance': ['Agree', 'Partly agree', 'Disagree'],
        '@right': ['Right', 'Partly right', 'Wrong']}

def parse_hard():
    items, cur = [], None
    for n, raw in enumerate(open(os.path.join(SP, 'quiz', 'hard.txt'), encoding='utf-8'), 1):
        line = raw.rstrip('\n')
        if not line.strip() or line.startswith('#'):
            continue
        where = 'hard.txt:%d' % n
        if line.startswith('@item '):
            cur = {'id': line.split()[1], 'also': [], 't': [], 'parts': []}
            items.append(cur)
            continue
        key, _, val = line.partition(': ')
        if key == 'Q':
            cur['q'] = val
        elif key in ('kind', 'best', 'src', 'why'):
            cur[key] = val
        elif key == 'also':
            cur['also'] = [x.strip() for x in val.split(',') if x.strip()]
        elif key == 'trap':
            a, _, b = val.partition(' || ')
            cur['t'].append([a.strip(), b.strip()])
        elif key == 'part':
            bits = [x.strip() for x in val.split(' || ')]
            if len(bits) != 4:
                die('a part needs ask || options || number || why at ' + where)
            ask, ops, ans, why = bits
            opts = SETS[ops] if ops in SETS else [x.strip() for x in ops.split(' | ')]
            ans = int(ans) - 1
            if not 0 <= ans < len(opts):
                die('answer number out of range at ' + where)
            if ops not in SETS:   # spread the right answer over the positions
                rng = random.Random('%s-%d' % (cur['id'], len(cur['parts'])))
                order = list(range(len(opts)))
                rng.shuffle(order)
                opts, ans = [opts[i] for i in order], order.index(ans)
            cur['parts'].append({'ask': ask, 'opts': opts, 'ans': ans, 'why': why})
        else:
            die('unknown line at %s: %r' % (where, line[:40]))
    return items

CARDS = parse_cards()
HARD = parse_hard()

# ---------------------------------------------------------------- build a card's plain block
ids_in_page = re.findall(r'<article class="card (?!quiz)[^"]*" id="([eg]\d+)"', s)
missing = [i.upper() for i in ids_in_page if i.upper() not in CARDS]
if missing:
    die('no plain text for ' + ', '.join(missing))

# spread the right option evenly over the positions, the same way every run
allq = [(cid, k) for cid in sorted(CARDS, key=lambda x: (x[0], int(x[1:]))) for k in range(len(CARDS[cid]['qs']))]
rng = random.Random(301)
slots = {}
for size in (3, 4):
    group = [x for x in allq if len(CARDS[x[0]]['qs'][x[1]]['opts']) == size]
    pos = [i % size for i in range(len(group))]
    rng.shuffle(pos)
    for x, p in zip(group, pos):
        slots[x] = p

def mcqs(c):
    out = []
    for k, q in enumerate(c['qs']):
        right = [o for o in q['opts'] if o[0]][0]
        wrong = [o for o in q['opts'] if not o[0]]
        opts = wrong[:]
        opts.insert(slots[(c['id'], k)], right)
        lis = ''.join('<li><button type="button" class="opt" data-ok="%d">%s</button><div class="why">%s</div></li>'
                      % (1 if o[0] else 0, esc(o[1]), esc(o[2])) for o in opts)
        out.append('<div class="mcq" data-q="%s-p%d"><p class="mq"><span class="qtag">%d of %d</span>%s</p><ol class="opts">%s</ol></div>'
                   % (c['id'], k + 1, k + 1, len(c['qs']), esc(q['q']), lis))
    return ''.join(out)

def plain_block(c, card_html):
    v = c['verdict']
    if v.startswith('other:'):
        vlabel, vcls = v[6:], 'other'
    else:
        vlabel, vcls = VERDICT[v]
    steps = ''.join('<li>%s</li>' % esc(x) for x in c['steps'])
    cues = re.search(r'<div class="cues">.*?</div>', card_html)
    alikes = re.search(r'<div class="alikes"><span class="cl">Not this essay if.*?</ul></div>', card_html, re.S)
    n = len(c['qs'])
    return ('<!--plain:card-->\n'
            '<section class="gist" data-plain>\n'
            '<div class="rh"><h3>The idea in 30 seconds</h3><button type="button" class="tbtn" data-act="recall" aria-pressed="false">Recall mode</button></div>\n'
            '<p class="rhint">Recall mode blurs your answer. Say it to yourself, then tap each part to check.</p>\n'
            '<dl class="gl">'
            '<dt>The statement says</dt><dd class="say">%s</dd>'
            '<dt>Your answer</dt><dd class="rv"><span class="vd %s">%s</span> %s</dd>'
            '<dt>Why, in %d steps</dt><dd class="rv"><ol class="three">%s</ol></dd>'
            '<dt>Remember</dt><dd class="rv rem">%s</dd>'
            '</dl>\n</section>\n'
            '<section class="spot2" data-plain>\n<h3>How to spot it</h3>\n<p>%s</p>\n%s%s\n</section>\n'
            '<section class="check" data-plain><h3>Quick check <span class="qs">%d easy question%s</span></h3>%s</section>\n'
            '<!--/plain:card-->\n'
            % (esc(c['say']), vcls, esc(vlabel), esc(c['answer']), len(c['steps']), steps, esc(c['remember']),
               esc(c['spot']), cues.group(0) if cues else '', alikes.group(0) if alikes else '',
               n, '' if n == 1 else 's', mcqs(c)))

def fix_card(m):
    art = m.group(0)
    cid = m.group(1).upper()
    c = CARDS[cid]
    art = re.sub(r'<!--plain:card-->.*?<!--/plain:card-->\n', '', art, flags=re.S)
    if 'data-plain-wrap' not in art:
        a = art.index('</header>') + len('</header>\n')
        b = art.index('<footer class="cf">')
        summ = ('All the statement types, and where each one goes' if cid == 'G1'
                else 'the exam question, the full answer route, a hypo and harder questions')
        art = (art[:a] + '<details class="deeper" data-plain-wrap><summary>Go deeper <span>%s</span></summary>\n' % summ
               + art[a:b] + '</details>\n' + art[b:])
    a = art.index('</header>') + len('</header>\n')
    art = art[:a] + plain_block(c, art) + art[a:]
    art = re.sub(r'(<span class="tag time">)≈ \d+ min read( \+ 1 min check)?</span>',
                 lambda t: t.group(1) + ('≈ 1 min read' if cid == 'G1' else '≈ 2 min read + 1 min check') + '</span>', art)
    art = art.replace('<span class="tl">Start 5:00</span>', '<span class="tl">Start 3:00</span>')
    return art

s, n = re.subn(r'<article class="card (?!quiz)[^"]*" id="([eg]\d+)".*?</article>', fix_card, s, flags=re.S)
print('cards:', n)

# ---------------------------------------------------------------- the map page
BIG = '''<!--plain:map-->
<div class="big" data-plain>
<h2>The big picture</h2>
<p>LAW301 keeps asking one question: <b>when may law enforce morality, and who decides?</b> The 45 essays come in five families.</p>
<ol class="fams">
<li><a class="ref r-law" href="#e1">E1–E13</a> <b>Law-making and morality.</b> Should Parliament use law to enforce morals? Whose morals: the majority's, a religion's, or nobody's?</li>
<li><a class="ref r-theory" href="#e14">E14–E19</a> <b>Testing a theory.</b> Is Hart, Devlin, Rawls or Finnis right? Plus euthanasia and abortion.</li>
<li><a class="ref r-judges" href="#e20">E20–E36</a> <b>Judges, lawyers and the Constitution.</b> Do they need theory and morality, or just the rules?</li>
<li><a class="ref r-lawis" href="#e37">E37–E44</a> <b>What law is, and obeying it.</b> Is law just a fact? Must you obey an unjust law? What is the rule of law?</li>
<li><a class="ref r-problem" href="#e45">E45</a> <b>The problem question.</b> Vote on a bill as an MP, then say as a judge whether you would enforce it.</li>
</ol>
<h3>The four thinkers, one line each</h3>
<ul class="who">
<li><b>Hart</b>: the law may punish to stop harm to others (and, carefully, to protect people whose consent is weak), never just because something is "immoral".</li>
<li><b>Devlin</b>: society may protect its shared morality by law; the test is what ordinary people, like a jury of twelve, would accept after discussion.</li>
<li><b>Rawls</b>: state power needs reasons every citizen could reasonably accept ("public reason"), not one religion's or one philosophy's.</li>
<li><b>Finnis</b>: natural law: seven basic goods (life, knowledge, friendship and others) give a few firm limits; the state keeps peace and justice.</li>
</ul>
<p class="also">You will also meet <b>TSH</b> (Tan Seow Hon: no law is neutral; refuse only intolerable injustice), <b>Fuller</b> (the rule of law's eight requirements), <b>Radbruch</b> (extreme injustice is not law), <b>Dworkin</b> (judges seek the best reading of the law), and <b>Pepper</b> and <b>Thunder</b> (the lawyer's role).</p>
<h3>Five ideas you will see everywhere</h3>
<dl class="words">
<dt>The ladder</dt><dd>Law can encourage, regulate or punish. The stronger the step, the better the reason it needs.</dd>
<dt>Harm principle</dt><dd>Law may use force only to stop harm to others.</dd>
<dt>Paternalism</dt><dd>Protecting people from themselves.</dd>
<dt>Public reason</dt><dd>A reason that people outside your faith or philosophy can examine.</dd>
<dt>Positivism, natural law</dt><dd>Positivism: what counts as law depends on its source, not on whether it is just. Natural law: at the extreme, injustice is not law.</dd>
</dl>
<h3>How to use this page</h3>
<ol class="use"><li>Open a card and read the 30-second outline: what the statement says, your answer, three steps, one line to remember.</li><li>Take the three easy questions under it. Everything else on the card is folded away under "Go deeper".</li><li>At the end of each family, take its quiz. It is harder: mostly hypos, and after finding the essay you give your verdict or your vote.</li></ol>
</div>
<!--/plain:map-->
'''
s = re.sub(r'<!--plain:map-->.*?<!--/plain:map-->\n', '', s, flags=re.S)
LEDE = ('<p class="lede">One card per essay, each starting with a 30-second outline in plain words and ending with three easy questions. '
        'Each family ends with a harder quiz, mostly hypos, where you find the essay and then give your verdict.</p>')
s = re.sub(r'<p class="lede">.*?</p>', LEDE, s, count=1, flags=re.S)
k = s.index('<div class="top">')
k = s.index('</div>', k) + len('</div>\n')
s = s[:k] + BIG + s[k:]
if 'data-plain-wrap><summary>Finding the essay' not in s:
    s = re.sub(r'(<div class="guide" style="margin-top:18px">.*?</div>)',
               r'<details class="deeper mapmore" data-plain-wrap><summary>Finding the essay in the exam <span>the four steps, and the keyboard keys</span></summary>\n\1</details>',
               s, count=1, flags=re.S)

# quiz names and intros
s = re.sub(r'Quiz (\d): find the essay</span>', r'Quiz \1: hypos and verdicts</span>', s)
s = re.sub(r'<b>Quiz (\d): find the essay among (E[\d–E]+)</b><span class="mt">[^<]*</span>',
           r'<b>Quiz \1: hypos and verdicts, \2</b><span class="mt">Find the essay, then give your verdict</span>', s)
FAMQ = ('<p class="qintro">The harder quiz for this family. Most questions are hypos or reworded statements. '
        '<b>Step 1:</b> pick the essay from the Index. <b>Step 2:</b> give your verdict: agree, partly agree or disagree, '
        'or your vote on each part of a bill. The feedback explains both. For the old warm-up, choose "Spot the essay only".</p>')
LASTQ = ('<p class="qintro">The final quiz: every essay and the problem question, under exam conditions (20 questions, 2 minutes each; change any setting). '
         'Mostly hypos: <b>step 1</b>, find the essay; <b>step 2</b>, give your verdict or your vote on each part.</p>')
def fix_quiz(m):
    art = m.group(0)
    art = art.replace('<span class="tt">Find the essay: ', '<span class="tt">Hypos and verdicts: ')
    return re.sub(r'<p class="qintro">.*?</p>', LASTQ if m.group(1) == '5' else FAMQ, art, count=1, flags=re.S)
s = re.sub(r'<article class="card quiz[^"]*" id="quiz-(\d)".*?</article>', fix_quiz, s, flags=re.S)

NOTE = ('<!--plain:note--> The 30-second outlines, the quick checks and the harder quiz are written in plain words from the same essays '
        '(their source is in essays/five-minute-plain). Verdicts follow each essay\'s thesis; on a free vote where either side can be defended, '
        'only the reasons are marked.<!--/plain:note-->')
s = re.sub(r'<!--plain:note-->.*?<!--/plain:note-->', '', s, flags=re.S)
s = s.replace('Your progress and quiz record stay in this browser.</p>',
              'Your progress and quiz record stay in this browser.' + NOTE + '</p>', 1)

# ---------------------------------------------------------------- styles
CSS = '''<style data-plain>
/* plain-words outline, quick check and verdict step (essays/five-minute-plain) */
.gist{margin-top:18px;padding:16px 18px;border-radius:12px;background:var(--c-soft)}
@media (max-width:560px){.gist{padding:13px 12px}}
.gist .rh h3{margin:0}
.gl{display:grid;grid-template-columns:9.2em minmax(0,1fr);gap:10px 14px;margin:12px 0 0}
.gl dt{padding-top:2px;color:var(--c);font-size:12.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
.gl dd{margin:0;line-height:1.5}
@media (max-width:560px){.gl{grid-template-columns:minmax(0,1fr);gap:2px}.gl dd{margin-bottom:10px}}
.gl .say{font-weight:700}
.gl .rem{font-weight:800}
.three{margin:0;padding-left:20px}.three li{margin:3px 0}
.vd{display:inline-block;margin:0 4px 2px 0;padding:0 9px;border-radius:999px;border:1px solid;font-size:13.5px;font-weight:800;white-space:nowrap}
.vd.agree{background:var(--good-soft);color:var(--good)}
.vd.partly{background:var(--half-soft);color:var(--half)}
.vd.disagree{background:var(--bad-soft);color:var(--bad)}
.vd.other{background:var(--sheet);color:var(--ink);border-color:var(--rule)}
.recall .gist .rv{cursor:pointer}
.recall .gist .rv:not(.shown){filter:blur(6px);user-select:none}
.spot2{margin-top:18px}
.spot2 p{margin:0}
.spot2 .cues .cue{background:var(--c-soft)}
.spot2 .alikes li .ref{background:var(--c-soft)}
details.deeper{margin-top:22px;padding:10px 16px;border:1px dashed var(--rule);border-radius:12px}
details.deeper>summary{cursor:pointer;color:var(--ink);font-weight:800}
details.deeper>summary span{color:var(--soft);font-weight:600}
details.deeper[open]>summary{margin-bottom:6px}
details.mapmore{margin-top:18px;background:var(--sheet)}
.big{margin-top:18px;padding:18px 20px;background:var(--sheet);border:1px solid var(--rule);border-radius:14px;box-shadow:var(--shadow)}
@media (max-width:560px){.big{padding:14px 13px}}
.big h2{margin:0 0 6px;font-size:21px;font-weight:800}
.big h3{margin:16px 0 6px;font-size:15px;font-weight:800}
.big p{margin:0}
.fams,.use{margin:8px 0 0;padding-left:22px}.fams li,.use li{margin:6px 0}
.who{margin:0;padding-left:20px}.who li{margin:5px 0}
.big .also{margin-top:8px;color:var(--soft);font-size:15px}
.words{display:grid;grid-template-columns:11em minmax(0,1fr);gap:6px 12px;margin:0}
.words dt{font-weight:800}.words dd{margin:0}
@media (max-width:560px){.words{grid-template-columns:minmax(0,1fr);gap:0}.words dd{margin-bottom:8px}}
#map .mrow .mc{display:none}
.stp{display:inline-block;margin-right:6px;padding:0 8px;border-radius:6px;background:var(--ink);color:var(--paper);font-size:12px;font-weight:800;letter-spacing:.03em;vertical-align:1px}
.vstep{margin-top:16px;padding-top:4px;border-top:1px solid var(--rule)}
.vyou{margin:6px 0 0;color:var(--soft);font-size:14.5px}
.vpart{margin-top:12px}
.vq{margin:0;font-weight:700}
.vopts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.vopt{display:flex;gap:8px;align-items:baseline;padding:8px 13px;border:1px solid var(--rule);border-radius:10px;background:var(--sheet);color:var(--ink);font:inherit;font-size:15px;text-align:left;cursor:pointer}
.vopt .k{color:var(--soft);font-weight:800;font-size:13px}
.vopt:hover{border-color:var(--ink)}
.vopt:disabled{cursor:default}
.vopt.chosen{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.vopt.chosen .k{color:var(--paper)}
.ixr.pick-mine{background:var(--hypo);border-color:var(--ink)}
.vfb{margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--sheet)}
.vfb .vh{margin:0;font-weight:800}
.vfb ul{list-style:none;margin:6px 0 0;padding:0}
.vfb li{margin:8px 0 0;padding-left:10px;border-left:3px solid var(--rule)}
.vfb li.vok{border-left-color:var(--good)}
.vfb li.vno{border-left-color:var(--bad)}
@media print{details.deeper{display:none}}
</style>
'''
s = re.sub(r'<style data-plain>.*?</style>\n', '', s, flags=re.S)
k = s.index('</style>') + len('</style>\n')
s = s[:k] + CSS + s[k:]

# ---------------------------------------------------------------- the harder quiz bank and the engine
for it in HARD:
    for key in ('q', 'why', 'src', 'kind', 'best'):
        if key not in it:
            die('item %s has no %s' % (it['id'], key))
known = set(re.findall(r'data-id="([EG]\d+)"', s))
for it in HARD:
    for e in [it['best']] + it['also'] + [t[0] for t in it['t']]:
        if e not in known:
            die('item %s names %s, which is not in the page' % (it['id'], e))
data = [{'id': 'h-' + it['id'], 'kind': it['kind'], 'best': it['best'], 'src': it['src'], 'also': it['also'],
         'q': esc(it['q']), 'w': esc(it['why']), 't': [[a, esc(b)] for a, b in it['t']],
         'parts': [{'ask': esc(p['ask']), 'opts': [esc(o) for o in p['opts']], 'ans': p['ans'], 'why': esc(p['why'])}
                   for p in it['parts']]} for it in HARD]
js = 'var HARD=' + json.dumps(data, ensure_ascii=False).replace('</', '<\\/') + ';'
s = re.sub(r'<script data-plain-data>.*?</script>\n', '', s, flags=re.S)
k = s.index('<script>\nvar ESSAYS=')
s = s[:k] + '<script data-plain-data>' + js + '</script>\n' + s[k:]

if '/*plain-engine v1*/' not in s:
    a = s.find('  var QZ=(function(){')
    b = s.find("  document.addEventListener('keydown',function(e){")
    if a < 0 or b < 0:
        die('could not find the quiz engine to patch')
    s = s[:a] + open(os.path.join(SP, 'qz.js'), encoding='utf-8').read() + s[b:]
    patches = [
        ("function fmtScore(s){return (Math.round(s*2)/2).toString().replace('.5','½').replace(/^0½/,'½');}",
         "function fmtScore(s){var r=Math.round(s*10)/10;return String(r);}"),
        ("c.classList.toggle('recall',!!(st.recall&&rb));if(rb)rb.setAttribute('aria-pressed',st.recall?'true':'false');",
         "c.classList.toggle('recall',!!(st.recall&&rb));[].forEach.call(c.querySelectorAll('[data-act=\"recall\"]'),function(x){x.setAttribute('aria-pressed',st.recall?'true':'false');});"),
        ("if(act==='recall'){st.recall=!st.recall;save(KEY,st);card.classList.toggle('recall',st.recall);b.setAttribute('aria-pressed',st.recall?'true':'false');",
         "if(act==='recall'){st.recall=!st.recall;save(KEY,st);card.classList.toggle('recall',st.recall);[].forEach.call(card.querySelectorAll('[data-act=\"recall\"]'),function(x){x.setAttribute('aria-pressed',st.recall?'true':'false');});"),
        ("'Start 5:00'", "'Start 3:00'"),
    ]
    for old, new in patches:
        if s.count(old) != 1:
            die('could not patch: ' + old[:50])
        s = s.replace(old, new)
    if s.count('left=300') != 2:
        die('could not patch the 5-minute timer')
    s = s.replace('left=300', 'left=180')

if s == orig:
    print('Nothing changed.')
else:
    open(TARGET, 'w', encoding='utf-8').write(s)
    nq = sum(len(c['qs']) for c in CARDS.values())
    hy = sum(1 for it in HARD if it['kind'] == 'hypo')
    print('Wrote %s: %d cards, %d quick-check questions, %d harder quiz items (%d hypos).'
          % (os.path.relpath(TARGET), len(CARDS), nq, len(HARD), hy))
