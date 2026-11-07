/* LAW302 Conflict Lessons: quiz engine, progress, page helpers.
   Progress lives in localStorage under one key; every access is guarded,
   so the site still works (without memory) in private windows. */
(function () {
  "use strict";
  var KEY = "law302-conflict-lessons-v1";
  var QB = window.QBANK || {};
  var LS = window.LESSONS || {};

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
  }
  var state = load();
  function rec(id) { return state[id] || { n: 0, miss: 0, last: "" }; }
  function record(id, ok) {
    var r = rec(id);
    r.n += 1;
    if (!ok) r.miss += 1;
    r.last = ok ? "ok" : "bad";
    state[id] = r;
    save(state);
  }
  function lessonIds(num) {
    return Object.keys(QB).filter(function (id) { return QB[id].lesson === num; });
  }
  function lessonProgress(num) {
    var ids = lessonIds(num), ok = 0, seen = 0;
    ids.forEach(function (id) { var r = state[id]; if (r) { seen++; if (r.last === "ok") ok++; } });
    return { total: ids.length, ok: ok, seen: seen };
  }

  /* ------------------------------------------------------------ quiz */
  var LETTERS = "ABCDEFG";

  function Quiz(el, ids, opts) {
    this.el = el;
    this.ids = ids.filter(function (id) { return QB[id]; });
    this.kind = opts.kind || "quiz";
    this.title = opts.title || "Quick check";
    this.i = 0;
    this.results = [];
    this.render();
  }
  Quiz.prototype.render = function () {
    var self = this;
    if (!this.ids.length) { this.el.innerHTML = '<p class="muted">No questions here yet.</p>'; return; }
    if (this.i >= this.ids.length) { return this.renderScore(); }
    var q = QB[this.ids[this.i]], r = rec(q.id);
    var kindLabel = (this.kind === "test" ? "◎ " : "⚡ ") + this.title + " · " + (this.i + 1) + " of " + this.ids.length;
    var html = '<div class="qc"><div class="qc-head"><span class="qc-kind">' + esc(kindLabel) + "</span>";
    if (q.level) html += '<span class="pill">' + q.level + "</span>";
    if (r.miss > 0) html += '<span class="pill warn">↻ Missed ' + r.miss + "× before</span>";
    else if (r.last === "ok") html += '<span class="pill ok">✓ Got it before</span>';
    if (this.ids.length > 1) {
      html += '<span class="qc-dots">';
      for (var k = 0; k < this.ids.length; k++) {
        var c = k === this.i ? "cur" : (this.results[k] === true ? "g" : (this.results[k] === false ? "b" : ""));
        html += '<span class="' + c + '"></span>';
      }
      html += "</span>";
    }
    html += '</div><div class="qc-q">' + q.q + '</div><div class="qc-opts">';
    q.opts.forEach(function (o, k) {
      html += '<button type="button" class="opt" data-k="' + k + '"><span class="lt">' + LETTERS[k] + '</span><span class="txt">' + o.t + "</span></button>";
    });
    html += '</div><div class="qc-foot"><button type="button" class="qc-btn" disabled>Check</button>';
    if (q.hint) html += '<button type="button" class="qc-hint-btn">💡 Hint</button>';
    html += '</div><div class="qc-hint" hidden>' + (q.hint || "") + '</div><div class="qc-fb"></div></div>';
    this.el.innerHTML = html;

    var chosen = null, checked = false;
    var btns = this.el.querySelectorAll(".opt");
    var go = this.el.querySelector(".qc-btn");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        if (checked) return;
        btns.forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        chosen = +b.getAttribute("data-k");
        go.disabled = false;
      });
    });
    var hb = this.el.querySelector(".qc-hint-btn");
    if (hb) hb.addEventListener("click", function () {
      var h = self.el.querySelector(".qc-hint"); h.hidden = !h.hidden;
    });
    go.addEventListener("click", function () {
      if (!checked) {
        if (chosen === null) return;
        checked = true;
        var ok = !!q.opts[chosen].ok;
        btns.forEach(function (b, k) {
          b.disabled = true;
          b.classList.remove("sel");
          var o = q.opts[k];
          if (o.ok) b.classList.add("right");
          else if (k === chosen) b.classList.add("wrong");
          else b.classList.add("dim");
          if (o.why) {
            var w = document.createElement("span"); w.className = "why"; w.innerHTML = o.why; b.appendChild(w);
          }
        });
        record(q.id, ok);
        self.results[self.i] = ok;
        var dot = self.el.querySelectorAll(".qc-dots span")[self.i];
        if (dot) dot.className = ok ? "g" : "b";
        var fb = self.el.querySelector(".qc-fb");
        fb.className = "qc-fb " + (ok ? "good" : "bad");
        fb.textContent = ok ? "Correct." : "Not quite. The right answer is " + LETTERS[q.opts.findIndex(function (o) { return o.ok; })] + "; read why each option is right or wrong.";
        go.textContent = self.i + 1 < self.ids.length ? "Next →" : (self.ids.length > 1 ? "See score" : "Done");
        if (self.i + 1 >= self.ids.length && self.ids.length === 1) go.disabled = true;
        refreshProgress();
      } else {
        self.i += 1;
        self.render();
        self.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  };
  Quiz.prototype.renderScore = function () {
    var self = this;
    var got = this.results.filter(function (x) { return x === true; }).length;
    var missed = this.ids.filter(function (id, k) { return self.results[k] === false; });
    var html = '<div class="qc"><div class="qc-head"><span class="qc-kind">' + esc(this.title) + ' · done</span></div><div class="qc-score">';
    html += '<div class="big">' + got + " / " + this.ids.length + "</div>";
    html += "<div>" + (got === this.ids.length ? "Perfect. Move on." : (got / this.ids.length >= 0.7 ? "Good. Reread the blocks behind the misses." : "Reread this part of the lesson, then retry.")) + "</div>";
    if (missed.length) {
      html += "<ul>";
      missed.forEach(function (id) { html += "<li>" + QB[id].q + "</li>"; });
      html += "</ul>";
    }
    html += '<div class="row"><button type="button" class="btn ghost" data-a="all">Retry all</button>';
    if (missed.length) html += '<button type="button" class="btn" data-a="missed">Retry the ' + missed.length + " missed</button>";
    html += "</div></div></div>";
    this.el.innerHTML = html;
    this.el.querySelectorAll("button[data-a]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("data-a") === "missed") self.ids = missed;
        self.i = 0; self.results = []; self.render();
      });
    });
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  document.querySelectorAll(".quiz").forEach(function (el) {
    var ids = (el.getAttribute("data-ids") || "").split(",").filter(Boolean);
    new Quiz(el, ids, { kind: el.getAttribute("data-kind"), title: el.getAttribute("data-title") });
  });

  /* ------------------------------------------------------------ progress displays */
  function refreshProgress() {
    document.querySelectorAll(".lcard[data-lesson]").forEach(function (c) {
      var p = lessonProgress(+c.getAttribute("data-lesson"));
      var pct = p.total ? Math.round(100 * p.ok / p.total) : 0;
      var bar = c.querySelector(".lc-bar span"); if (bar) bar.style.width = pct + "%";
      var t = c.querySelector(".lc-prog");
      if (t) t.textContent = p.seen ? (p.ok + " of " + p.total + " right on last try") : "Not started";
    });
    document.querySelectorAll(".toc-prog[data-lesson]").forEach(function (t) {
      var p = lessonProgress(+t.getAttribute("data-lesson"));
      t.textContent = p.total ? ("Progress: " + p.ok + " / " + p.total + " questions right") : "";
    });
  }
  refreshProgress();

  /* ------------------------------------------------------------ archetype collapse */
  document.querySelectorAll(".archetype").forEach(function (a) {
    var b = a.querySelector(".arch-toggle");
    if (!b) return;
    b.addEventListener("click", function () {
      var c = a.classList.toggle("collapsed");
      b.textContent = c ? "Expand" : "Collapse";
      b.setAttribute("aria-expanded", c ? "false" : "true");
    });
  });
  // a link into a collapsed panel opens it
  function openTarget() {
    if (!location.hash) return;
    var t = document.getElementById(location.hash.slice(1));
    if (!t) return;
    var a = t.closest(".archetype");
    if (a && a.classList.contains("collapsed")) a.querySelector(".arch-toggle").click();
    var d = t.closest("details"); if (d) d.open = true;
    return t;
  }
  window.addEventListener("hashchange", openTarget);
  var first = openTarget();
  if (first) {
    // quizzes render after the browser's own jump, so jump again once layout settles
    var jump = function () { first.scrollIntoView({ block: "start" }); };
    requestAnimationFrame(jump);
    window.addEventListener("load", function () { setTimeout(jump, 30); });
  }

  /* ------------------------------------------------------------ toc */
  var toc = document.querySelector(".toc");
  if (toc) {
    toc.addEventListener("click", function (e) {
      if (window.innerWidth <= 920 && (e.target === toc)) toc.classList.toggle("open");
    });
    var links = Array.prototype.slice.call(toc.querySelectorAll("a[href^='#']"));
    var targets = links.map(function (l) { return document.getElementById(l.getAttribute("href").slice(1)); });
    function onScroll() {
      var y = window.scrollY + 150, cur = -1;
      targets.forEach(function (t, k) { if (t && t.getBoundingClientRect().top + window.scrollY <= y) cur = k; });
      links.forEach(function (l, k) { l.classList.toggle("on", k === cur); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("load", function () { setTimeout(onScroll, 50); });
    window.addEventListener("hashchange", function () { setTimeout(onScroll, 400); });
    onScroll();
  }

  /* ------------------------------------------------------------ review page */
  var go = document.getElementById("rv-go");
  if (go) {
    var area = document.getElementById("rv-area");
    var stats = document.getElementById("rv-stats");
    function pool() {
      var L = document.getElementById("rv-lesson").value;
      var ids = Object.keys(QB).filter(function (id) { return L === "all" || QB[id].lesson === +L; });
      return ids;
    }
    function showStats() {
      var ids = Object.keys(QB), seen = 0, ok = 0, missed = 0;
      ids.forEach(function (id) { var r = state[id]; if (r) { seen++; if (r.last === "ok") ok++; if (r.miss > 0 && r.last !== "ok") missed++; } });
      stats.textContent = ids.length + " questions in all · " + seen + " answered · " + ok + " right on last try · " + missed + " still missed.";
    }
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    go.addEventListener("click", function () {
      var mode = document.getElementById("rv-mode").value, ids = pool();
      if (mode === "missed") ids = ids.filter(function (id) { var r = state[id]; return r && r.miss > 0 && r.last !== "ok"; });
      if (mode === "unseen") ids = ids.filter(function (id) { return !state[id]; });
      ids = shuffle(ids);
      if (mode === "random") ids = ids.slice(0, 15);
      if (!ids.length) {
        area.innerHTML = '<div class="box note"><div class="box-label">ℹ NOTHING TO DRILL</div><p>' +
          (mode === "missed" ? "No missed questions in this set. Try “Random 15”." : "No questions match.") + "</p></div>";
        return;
      }
      area.innerHTML = '<div class="quiz"></div>';
      new Quiz(area.firstChild, ids, { kind: "test", title: mode === "missed" ? "Missed questions" : "Review" });
      showStats();
    });
    document.getElementById("rv-reset").addEventListener("click", function () {
      if (!confirm("Clear every saved answer in this browser?")) return;
      state = {}; save(state); showStats(); area.innerHTML = "";
    });
    showStats();
  }
})();
