/* Section timer for the hypo practice page (practice.html).

   Every quiz on a page closes a "section": the text from the previous quiz (or the
   top of the page) down to that quiz. While you read or answer, the active time is
   added to the section you are in. Time stops after 3 minutes without scrolling,
   typing or touching, and while the tab is hidden.

   - The section heading shows the time spent (or the estimate if not started).
   - Finishing a quiz shows the section's time and an updated estimate of the time
     left: this page, this course, everything.
   - The end of each page has a table of its sections; the home page shows the time
     left per course and per lesson.

   Estimates start from a standard pace (170 words a minute, 1 minute a question) and
   are scaled by your own pace on the sections you have finished.

   Timings live in this browser (localStorage "lpa-timer-v1") and, if you saved
   progress with a GitHub token (G), in the same secret gist as the answers, in a
   file of their own. Loaded by: <script src="timer/timer.js" defer data-lpa-timer> */
(function () {
  "use strict";
  if (window.__lpaTimer) return;
  window.__lpaTimer = true;

  var KEY = "lpa-timer-v1", DEVKEY = "lpa-timer-dev", PROGKEY = "law301-302-practice-v1", SYNCKEY = "law301-302-combined-sync";
  var TFILE = "law301-302-practice-timer.json", APP = "law301-302-practice-timer";
  var WPM = 170, QSEC = 60, IDLE = 180, PRIOR = 900;
  var COURSE = { "302": "LAW302", "301": "LAW301" }, CORDER = ["302", "301"];

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? (JSON.parse(v) || d) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } catch (e) { /* private window */ } }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var dev = "";
  try { dev = localStorage.getItem(DEVKEY) || ""; } catch (e) { dev = ""; }
  if (!dev) { dev = "d" + Math.random().toString(36).slice(2, 10); lsSet(DEVKEY, dev); }

  var doc = lsGet(KEY, null);
  if (!doc || doc.app !== APP || typeof doc.units !== "object") doc = { app: APP, v: 1, resetAt: 0, units: {} };
  function rec(key) {
    var r = doc.units[key];
    if (!r) { r = doc.units[key] = { p: {}, u: 0 }; }
    if (!r.p) r.p = {};
    return r;
  }
  function spent(key) {
    var r = doc.units[key], t = 0;
    if (!r || !r.p) return 0;
    Object.keys(r.p).forEach(function (d) { t += r.p[d] || 0; });
    return t;
  }
  function saveLocal() { lsSet(KEY, doc); }

  /* ------------------------------------------------------------ format */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dur(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec < 1 ? "0 min" : "<1 min";
    var m = Math.round(sec / 60);
    if (m < 60) return m + " min";
    return Math.floor(m / 60) + " h " + pad(m % 60) + " min";
  }
  function clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  /* ------------------------------------------------------------ sections */
  var QB = window.QBANK || {};
  var pages = {}, units = [], byKey = {}, byQuiz = new Map();

  function words(str) { var m = str.match(/\S+/g); return m ? m.length : 0; }
  function headText(h) { return h ? (($(".sectitle", h) || h).textContent || "").replace(/\s+/g, " ").trim() : ""; }

  function build() {
    $$("article.page").forEach(function (art) {
      var quizzes = $$(".quiz", art).filter(function (q) {
        return (q.getAttribute("data-ids") || "").split(",").some(function (id) { return QB[id]; });
      });
      if (!quizzes.length) return;
      var pg = { id: art.id, el: art, course: art.getAttribute("data-course") || "", units: [] };
      pages[art.id] = pg;
      var h2 = null, h3 = null, seen = new Map();
      $$("h2.sec, h3, .quiz", art).forEach(function (el) {
        if (el.tagName === "H2") { h2 = el; h3 = null; return; }
        if (el.tagName === "H3") { h3 = el; return; }
        if (quizzes.indexOf(el) >= 0) seen.set(el, { h2: h2, h3: h3 });
      });
      var prev = null;
      quizzes.forEach(function (q, i) {
        var r = document.createRange();
        if (prev) r.setStartAfter(prev); else r.setStart(art, 0);
        r.setEndBefore(q);
        var w = words(r.toString());
        if (i === quizzes.length - 1) {
          var r2 = document.createRange();
          r2.setStartAfter(q); r2.setEnd(art, art.childNodes.length);
          w += words(r2.toString());
        }
        var ids = (q.getAttribute("data-ids") || "").split(",").filter(function (id) { return QB[id]; });
        var pos = seen.get(q) || {};
        var u = {
          key: art.id + "|" + ids[0], page: pg, quiz: q, ids: ids, h2: pos.h2 || null, h3: pos.h3 || null,
          test: q.getAttribute("data-kind") === "test", title: q.getAttribute("data-title") || "Quick check",
          words: w, base: w / WPM * 60 + ids.length * QSEC, idx: pg.units.length
        };
        pg.units.push(u); units.push(u); byKey[u.key] = u; byQuiz.set(q, u);
        prev = q;
      });
      // label: section title, plus the sub-heading where a section has several checks
      pg.units.forEach(function (u) {
        var same = pg.units.filter(function (v) { return v.h2 === u.h2; }).length;
        if (u.test) u.label = u.title;
        else u.label = (headText(u.h2) || "Introduction") + (same > 1 && u.h3 ? " · " + headText(u.h3) : "");
      });
    });
  }

  /* ------------------------------------------------------------ estimates */
  var prog = {};
  function readProgress() { prog = lsGet(PROGKEY, {}) || {}; }
  function isDone(u) {
    var r = doc.units[u.key];
    if (r && r.d) return true;
    // answered before the timer existed: every question of the check has a record
    return u.ids.length > 0 && u.ids.every(function (id) { return prog[id]; });
  }
  function pace() {
    var A = 0, B = 0, n = 0;
    units.forEach(function (u) {
      var r = doc.units[u.key];
      if (r && r.d && (r.dt || 0) >= 30) { A += r.dt; B += u.base; n++; }
    });
    var f = (A + PRIOR) / (B + PRIOR);
    return { f: Math.min(5, Math.max(0.2, f)), n: n };
  }
  function left(u, f) {
    if (isDone(u)) return 0;
    var est = f * u.base, s = spent(u.key);
    return Math.max(est - s, est * 0.1);
  }
  function totals(list, f) {
    var l = 0, s = 0, done = 0;
    list.forEach(function (u) { l += left(u, f); s += spent(u.key); if (isDone(u)) done++; });
    return { left: l, spent: s, done: done, n: list.length };
  }
  function courseUnits(c) { return units.filter(function (u) { return u.page.course === c; }); }
  function overview() {
    readProgress();
    var p = pace(), o = { pace: p, all: totals(units, p.f), c: {} };
    CORDER.forEach(function (c) { o.c[c] = totals(courseUnits(c), p.f); });
    return o;
  }
  function paceLine(p) {
    if (!p.n) return "Standard pace for now (170 words a minute, 1 minute a question). It adjusts to you as you finish sections.";
    var pct = Math.round(p.f * 100);
    return "At your pace: " + pct + "% of the standard estimate, from " + p.n + " timed section" + (p.n === 1 ? "" : "s") + ".";
  }
  function everythingLine(o) {
    var parts = CORDER.filter(function (c) { return o.c[c].n; }).map(function (c) { return COURSE[c] + " ≈ " + dur(o.c[c].left); });
    return "<b>Everything left ≈ " + dur(o.all.left) + "</b>" + (parts.length > 1 ? " (" + parts.join(" · ") + ")" : "");
  }

  /* ------------------------------------------------------------ styles */
  var css = [
    "#tm-chip{flex:none;padding:0 9px;gap:5px}",
    "#tm-chip .tm-clock{font-variant-numeric:tabular-nums}",
    "#tm-chip .tm-left{display:none}",
    "@media (max-width:900px){#tm-chip{display:none}}",
    "@media (min-width:901px){.tb>.tb-btn{flex-shrink:0}}",
    "#tm-chip.idle{opacity:.55}",
    "h2.sec[data-tm]{flex-wrap:wrap}",
    "h2.sec[data-tm]::after{content:attr(data-tm);margin-left:auto;flex:none;font-size:.72rem;font-weight:800;letter-spacing:.02em;padding:3px 10px;border-radius:999px;background:var(--grey-soft);color:var(--muted);white-space:nowrap}",
    "h2.sec[data-tm-st=on]::after{background:var(--teal-soft);color:var(--teal)}",
    "h2.sec[data-tm-st=done]::after{background:var(--green-soft);color:var(--green)}",
    ".tm-card{margin-top:10px;border:1px solid var(--teal-line);background:var(--teal-soft);border-radius:12px;padding:10px 14px;font-size:.9rem;line-height:1.5}",
    ".tm-card p{margin:.25em 0}",
    ".tm-k{font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--teal)}",
    ".tm-sum .tm-tw{overflow-x:auto}",
    ".tm-sum table{width:100%;border-collapse:collapse;font-size:.88rem;margin:.4em 0}",
    ".tm-sum th,.tm-sum td{padding:5px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}",
    ".tm-sum th{font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}",
    ".tm-sum td.n,.tm-sum th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}",
    ".tm-sum tr.cur td{background:var(--teal-soft)}",
    ".tm-sum tr.tm-tot td{font-weight:800;border-bottom:0}",
    ".tm-st-done{color:var(--green);font-weight:800}",
    ".tm-sum .tm-foot{font-size:.86rem;color:var(--ink2)}",
    ".tm-reset{font:inherit;font-size:.78rem;background:none;border:0;color:var(--muted);text-decoration:underline;cursor:pointer;padding:0}",
    ".tm-home{font-size:.84rem;color:var(--ink2);margin-top:6px}",
    ".tm-lc{font-size:.78rem;color:var(--muted);margin-top:4px}",
    ".tm-hero{font-size:.9rem;margin:.6em 0 0;color:var(--ink2)}"
  ].join("\n");
  var st = document.createElement("style");
  st.id = "tm-style"; st.textContent = css;
  document.head.appendChild(st);

  /* ------------------------------------------------------------ UI: toolbar chip */
  var chip = document.createElement("button");
  chip.type = "button"; chip.id = "tm-chip"; chip.className = "tb-btn";
  chip.title = "Time on this section. Click for the timings of this page.";
  chip.innerHTML = '<span aria-hidden="true">⏱</span><span class="tm-clock">0:00</span><span class="tm-left"></span>';
  var tb = $(".tb"), help = $("#help-open");
  if (tb) { if (help) tb.insertBefore(chip, help); else tb.appendChild(chip); }
  chip.addEventListener("click", function () {
    var pg = curPage(), box = pg ? $("#tm-sum-" + pg.id) : $("#tm-hero");
    if (box) { renderPage(pg); box.scrollIntoView({ block: "center", behavior: "smooth" }); }
  });

  function curPage() {
    var art = $("article.page:not([hidden])");
    return art ? pages[art.id] || null : null;
  }
  function curUnit(pg) {
    var line = window.innerHeight * 0.4, us = pg.units;
    for (var i = 0; i < us.length; i++) {
      var r = us[i].quiz.getBoundingClientRect();
      if (r.height > 0 && r.bottom > line) return us[i];
    }
    return us[us.length - 1];
  }

  /* ------------------------------------------------------------ UI: headings */
  function badge(h2, pg, f) {
    if (!h2) return;
    var us = pg.units.filter(function (u) { return u.h2 === h2; });
    if (!us.length) return;
    var s = 0, l = 0, done = 0;
    us.forEach(function (u) { s += spent(u.key); l += left(u, f); if (isDone(u)) done++; });
    var text, state;
    if (done === us.length) { text = "✓ " + (s >= 30 ? dur(s) : "done"); state = "done"; }
    else if (s >= 30) { text = "⏱ " + dur(s) + " · ~" + dur(l) + " left"; state = "on"; }
    else { text = "~" + dur(l); state = "new"; }
    h2.setAttribute("data-tm", text);
    h2.setAttribute("data-tm-st", state);
  }
  function badges(pg, f) {
    var seen = new Set();
    pg.units.forEach(function (u) { if (u.h2 && !seen.has(u.h2)) { seen.add(u.h2); badge(u.h2, pg, f); } });
  }

  /* ------------------------------------------------------------ UI: page summary */
  function summaryBox(pg) {
    var box = $("#tm-sum-" + pg.id);
    if (box) return box;
    box = document.createElement("div");
    box.className = "box note tm-sum"; box.id = "tm-sum-" + pg.id;
    var pn = $(".pn", pg.el);
    if (pn && pn.parentNode) pn.parentNode.insertBefore(box, pn);
    else ($(".lesson", pg.el) || pg.el).appendChild(box);
    box.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".tm-reset");
      if (!b) return;
      if (!confirm("Reset all section timings, on every page? Your answers are kept.")) return;
      doc = { app: APP, v: 1, resetAt: Date.now(), units: {} };
      saveLocal(); dirty = true; scheduleSync(1500); refreshAll();
    });
    return box;
  }
  function renderPage(pg) {
    if (!pg) return;
    var o = overview(), f = o.pace.f, cu = curPage() === pg ? curUnit(pg) : null, t = totals(pg.units, f);
    var rows = pg.units.map(function (u) {
      var s = spent(u.key), d = isDone(u);
      var status = d ? '<span class="tm-st-done">✓ done</span>'
        : (s >= 30 ? "≈ " + dur(left(u, f)) + " left" : "not started · ≈ " + dur(left(u, f)));
      return '<tr' + (u === cu ? ' class="cur"' : "") + '><td>' + esc(u.label) + '</td><td class="n">' + (s >= 1 ? dur(s) : "–") + '</td><td class="n">' + status + "</td></tr>";
    }).join("");
    var html = '<div class="box-label">⏱ Time on this page</div><div class="tm-tw"><table><thead><tr><th>Section</th><th class="n">Time spent</th><th class="n">Status</th></tr></thead><tbody>' + rows +
      '<tr class="tm-tot"><td>' + t.done + " of " + t.n + ' sections done</td><td class="n">' + dur(t.spent) + '</td><td class="n">≈ ' + dur(t.left) + " left</td></tr></tbody></table></div>" +
      '<p class="tm-foot">' + everythingLine(o) + ". " + esc(paceLine(o.pace)) + "</p>" +
      '<p class="tm-foot">Time counts while you read or answer on a page and stops after 3 minutes without activity. <button type="button" class="tm-reset">Reset timings</button></p>';
    summaryBox(pg).innerHTML = html;
    badges(pg, f);
  }

  /* ------------------------------------------------------------ UI: home */
  function renderHome() {
    if (!$("#home")) return;
    var o = overview();
    CORDER.forEach(function (c) {
      var card = $('.ccard[data-course="' + c + '"]'), t = o.c[c];
      if (!card || !t.n) return;
      var el = $(".tm-home", card);
      if (!el) { el = document.createElement("div"); el.className = "tm-home"; var act = $(".cc-act", card); card.insertBefore(el, act || null); }
      el.textContent = "⏱ ≈ " + dur(t.left) + " left at your pace" + (t.spent >= 60 ? " · " + dur(t.spent) + " spent" : "") + " · " + t.done + " of " + t.n + " sections done";
    });
    $$("a.lcard[href^='#']").forEach(function (a) {
      var pg = pages[a.getAttribute("href").slice(1)];
      if (!pg) return;
      var t = totals(pg.units, o.pace.f), el = $(".tm-lc", a);
      if (!el) { el = document.createElement("div"); el.className = "tm-lc"; a.appendChild(el); }
      el.textContent = t.done === t.n ? "⏱ All sections done" + (t.spent >= 60 ? " · " + dur(t.spent) : "") : "⏱ ≈ " + dur(t.left) + " left" + (t.spent >= 60 ? " · " + dur(t.spent) + " spent" : "");
    });
    var hero = $("#tm-hero");
    if (!hero) {
      hero = document.createElement("p"); hero.id = "tm-hero"; hero.className = "tm-hero";
      var cont = $("#continue");
      if (cont && cont.parentNode) cont.parentNode.insertBefore(hero, cont.nextSibling);
    }
    if (hero) hero.innerHTML = "⏱ " + everythingLine(o) + ". " + esc(paceLine(o.pace));
  }

  /* ------------------------------------------------------------ UI: quiz finished */
  function finished(q) {
    var z = q._quiz;
    if (!z || !z.ids || !z.ids.length || !z.results) return false;
    for (var k = 0; k < z.ids.length; k++) if (typeof z.results[k] !== "boolean") return false;
    return true;
  }
  function onQuizChange(q) {
    var u = byQuiz.get(q);
    if (!u || !finished(q) || $(".tm-card", q)) return;
    var r = rec(u.key), first = !r.d;
    if (first) { r.d = Date.now(); r.dt = spent(u.key); r.u = Date.now(); saveLocal(); dirty = true; scheduleSync(4000); }
    var o = overview(), f = o.pace.f, pg = u.page, t = totals(pg.units, f), c = o.c[pg.course];
    var s = first ? r.dt : spent(u.key), est = f * u.base;
    var card = document.createElement("div");
    card.className = "tm-card";
    card.innerHTML = '<div class="tm-k">⏱ ' + (u.test ? "Test" : "Section") + " timed</div>" +
      "<p>" + esc(u.label) + ": <b>" + dur(s) + "</b>" + (s >= 30 ? " (estimate at your pace was " + dur(est) + ")" : "") + ".</p>" +
      "<p>Time left: this page ≈ <b>" + dur(t.left) + "</b>" + (c ? " · " + COURSE[pg.course] + " ≈ <b>" + dur(c.left) + "</b>" : "") + " · " + everythingLine(o) + ".</p>" +
      '<p style="color:var(--muted);font-size:.84rem">' + esc(paceLine(o.pace)) + "</p>";
    q.appendChild(card);
    renderPage(pg);
  }
  build();
  units.forEach(function (u) {
    var mo = new MutationObserver(function () { onQuizChange(u.quiz); });
    mo.observe(u.quiz, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  });

  /* ------------------------------------------------------------ the clock */
  var lastAct = Date.now(), ticks = 0, homeTick = 0, dirty = false, lastUnit = null;
  ["scroll", "wheel", "mousemove", "keydown", "pointerdown", "touchstart"].forEach(function (ev) {
    window.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true, capture: true });
  });
  function tick() {
    var pg = curPage();
    chip.hidden = false;
    if (!pg) {
      if (homeTick++ % 15) return;
      var o = overview();
      chip.classList.remove("idle");
      $(".tm-clock", chip).textContent = "≈ " + dur(o.all.left) + " left";
      $(".tm-left", chip).textContent = "";
      chip.title = "Estimated time to finish every hypo page. Click for details.";
      return;
    }
    var u = curUnit(pg), active = document.visibilityState === "visible" && Date.now() - lastAct < IDLE * 1000;
    if (active) {
      var r = rec(u.key);
      r.p[dev] = (r.p[dev] || 0) + 1; r.u = Date.now();
      dirty = true;
      if (++ticks % 10 === 0) saveLocal();
      if (ticks % 300 === 0) scheduleSync(1000);
    }
    chip.classList.toggle("idle", !active);
    $(".tm-clock", chip).textContent = clock(spent(u.key));
    if (u !== lastUnit || ticks % 15 === 0) {
      lastUnit = u;
      var p = pace(), t = totals(pg.units, p.f);
      $(".tm-left", chip).textContent = " · ≈ " + dur(t.left) + " left";
      badge(u.h2, pg, p.f);
    }
    chip.title = (active ? "Timing: " : "Paused (no activity for 3 minutes): ") + u.label + "." + ($(".tm-left", chip).textContent ? " This page" + $(".tm-left", chip).textContent.replace(" · ", ": ") + "." : "") + " Click for the timings of this page.";
  }
  setInterval(tick, 1000);

  function refreshAll() {
    var pg = curPage();
    if (pg) renderPage(pg);
    else renderHome();
    lastUnit = null; homeTick = 0;
  }
  window.addEventListener("hashchange", function () { setTimeout(refreshAll, 60); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { saveLocal(); pushOnHide(); }
  });
  window.addEventListener("pagehide", saveLocal);
  // badges and summaries for every page once, then keep the current one fresh
  Object.keys(pages).forEach(function (id) { renderPage(pages[id]); });
  renderHome();

  /* ------------------------------------------------------------ gist sync (same token and gist as the answers) */
  var syncTimer = null, syncing = false, pushedAt = 0;
  function syncInfo() { var s = lsGet(SYNCKEY, {}); return s && s.token && s.gist && !s.bad ? s : null; }
  function gh(s, method, path, body, keepalive) {
    var headers = { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + s.token };
    if (body) headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com" + path, { method: method, headers: headers, cache: "no-store", keepalive: !!keepalive, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.status === 204 ? {} : r.json(); });
  }
  function merge(a, b) {
    var resetAt = Math.max(a.resetAt || 0, b.resetAt || 0), out = {};
    [a.units || {}, b.units || {}].forEach(function (src) {
      Object.keys(src).forEach(function (k) {
        var r = src[k];
        if (!r || (r.u || 0) < resetAt) return;
        var o = out[k] || (out[k] = { p: {}, u: 0 });
        Object.keys(r.p || {}).forEach(function (d) { o.p[d] = Math.max(o.p[d] || 0, r.p[d] || 0); });
        o.u = Math.max(o.u || 0, r.u || 0);
        if (r.d && (!o.d || r.d < o.d)) { o.d = r.d; o.dt = r.dt; }
      });
    });
    return { app: APP, v: 1, resetAt: resetAt, units: out };
  }
  function readRemote(s) {
    return gh(s, "GET", "/gists/" + s.gist).then(function (g) {
      var f = g.files && g.files[TFILE], d = null;
      try { d = f && f.content ? JSON.parse(f.content) : null; } catch (e) { d = null; }
      return d && d.app === APP ? d : { app: APP, v: 1, resetAt: 0, units: {} };
    });
  }
  function body(d) { var f = {}; f[TFILE] = { content: JSON.stringify(d) }; return { files: f }; }
  function syncNow() {
    var s = syncInfo();
    if (!s || syncing) return;
    syncing = true;
    saveLocal();
    readRemote(s).then(function (remote) {
      var merged = merge(doc, remote);
      doc = merged; saveLocal();
      if (JSON.stringify(merged.units) !== JSON.stringify(remote.units) || (merged.resetAt || 0) !== (remote.resetAt || 0)) {
        return gh(s, "PATCH", "/gists/" + s.gist, body(merged));
      }
    }).then(function () { dirty = false; pushedAt = Date.now(); refreshAll(); })
      .catch(function () { /* offline or no access: the timings stay in this browser */ })
      .then(function () { syncing = false; });
  }
  function scheduleSync(ms) {
    if (!syncInfo()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, ms);
  }
  function pushOnHide() {
    var s = syncInfo();
    if (!s || !dirty || syncing || Date.now() - pushedAt < 30000) return;
    readRemote(s).then(function (remote) {
      var merged = merge(doc, remote);
      return gh(s, "PATCH", "/gists/" + s.gist, body(merged), true);
    }).then(function () { dirty = false; pushedAt = Date.now(); }).catch(function () {});
  }
  setTimeout(function () { scheduleSync(0); }, 4000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && Date.now() - pushedAt > 120000) scheduleSync(1500);
  });
})();
