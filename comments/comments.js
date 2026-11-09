/* Reading comments (Notion-style) for the LAW301 + LAW302 lessons site.

   Select text, press "Comment" (or Ctrl/Cmd+Shift+M), type, press Enter. The text gets a
   yellow highlight and the comment sits in a column on the right, level with the text.

   This file is deliberately separate from the course pages, so uploading new course HTML
   never touches it. The one <script> tag that loads it is put back automatically by
   .github/workflows/keep-comments.yml (which runs comments/attach.py) whenever a page
   without it is pushed. Comments are stored in this browser (localStorage key
   "lpa-comments-v1") and, when a GitHub token is available, in a secret gist, never in
   the HTML. Each comment is anchored by its quoted text and the words around it, so it
   finds its place again after the lesson is rewritten. If the quoted text disappears,
   the comment is kept and listed as "text not found" instead of being lost. */
(function () {
  "use strict";
  if (window.__lpaComments) return;
  window.__lpaComments = true;

  var SKEY = "lpa-comments-v1", PKEY = "lpa-comments-prefs", CSYNC = "lpa-comments-sync";
  var APPSYNC = "law301-302-combined-sync", GFILE = "lpa-lessons-comments.json", APP = "lpa-lessons-comments";
  var CM_W = 300;
  var HAS_HL = !!(window.CSS && CSS.highlights && window.Highlight);
  var root = document.documentElement;

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? (JSON.parse(v) || d) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  /* ------------------------------------------------------------ data */
  var db = lsGet(SKEY, null);
  if (!db || typeof db.items !== "object") db = { app: APP, v: 1, items: {} };
  var prefs = lsGet(PKEY, {});
  function savePrefs() { lsSet(PKEY, prefs); }
  function persist(noSync) {
    db.saved = Date.now();
    if (!lsSet(SKEY, db)) toast("Couldn't save in this browser (storage full or blocked). Download a backup from the Comments panel.");
    if (!noSync) scheduleSync(2000);
  }
  function all() { return Object.keys(db.items).map(function (k) { return db.items[k]; }); }
  function live(c) { return c && !c.deleted; }
  function threads(page) {
    return all().filter(function (c) { return live(c) && !c.parent && (!page || c.page === page); });
  }
  function replies(id) {
    return all().filter(function (c) { return live(c) && c.parent === id; }).sort(function (a, b) { return a.created - b.created; });
  }
  function touch(c) { c.updated = Date.now(); db.items[c.id] = c; }

  /* ------------------------------------------------------------ which page is showing */
  function pathKey() { return location.pathname.replace(/index\.html?$/i, ""); }
  function activePage() {
    var pages = $$("main .page, body > .page").filter(function (p) { return !p.hidden && p.getClientRects().length; });
    return pages.length === 1 && pages[0].id ? pages[0] : null;
  }
  function currentRoot() { return activePage() || $("main") || document.body; }
  function currentKey() { var p = activePage(); return pathKey() + (p ? "#" + p.id : ""); }
  function pageLabel(key) {
    var i = key.indexOf("#"), id = i >= 0 ? key.slice(i + 1) : "";
    if (key.slice(0, i >= 0 ? i : key.length) === pathKey() && id) {
      var nl = $('.nav a[href="#' + id + '"]');
      if (nl) {
        var parts = $$(":scope > span", nl).filter(function (x) { return !/nl-p|\bni\b/.test(x.className); }).map(function (x) { return x.textContent.trim(); }).filter(Boolean);
        return (parts.length ? parts.join(" · ") : nl.textContent).replace(/\s+/g, " ").trim();
      }
      var el = document.getElementById(id), h = el && $("h1", el);
      if (h) return h.textContent.trim();
    }
    return id || key.split("/").filter(Boolean).pop() || "Home";
  }
  function pageHref(key) {
    var i = key.indexOf("#"), path = i >= 0 ? key.slice(0, i) : key, id = i >= 0 ? key.slice(i) : "";
    return path === pathKey() ? (id || "#") : path + id;
  }

  /* ------------------------------------------------------------ text index: anchor comments by their words */
  var SKIP = "script,style,noscript,textarea,select,.cm-ui";
  function buildIndex(rootEl) {
    var w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { var p = n.parentElement; return !p || p.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var chars = [], nodes = [], offs = [], list = [], first = [], sp = true, n;
    while ((n = w.nextNode())) {
      var t = n.nodeValue; list.push(n); first.push(chars.length);
      for (var i = 0; i < t.length; i++) {
        var c = t.charCodeAt(i), ch = t[i];
        if (c === 32 || c === 10 || c === 9 || c === 13 || c === 160 || c === 12) { if (sp) continue; ch = " "; sp = true; } else sp = false;
        chars.push(ch); nodes.push(n); offs.push(i);
      }
    }
    var s = chars.join("");
    return { root: rootEl, s: s, low: null, nodes: nodes, offs: offs, list: list, first: first };
  }
  function posOf(ix, node, off, isEnd) {
    var k = ix.list.indexOf(node); if (k < 0) return -1;
    var p = ix.first[k], end = k + 1 < ix.first.length ? ix.first[k + 1] : ix.s.length;
    while (p < end && ix.offs[p] < off) p++;
    if (isEnd) return p; // exclusive end
    return p;
  }
  function rangeToPos(ix, r) {
    var inter = [];
    for (var i = 0; i < ix.list.length; i++) { try { if (r.intersectsNode(ix.list[i])) inter.push(ix.list[i]); } catch (e) { /* detached */ } }
    if (!inter.length) return null;
    var a0 = inter[0], b0 = inter[inter.length - 1];
    var a = posOf(ix, a0, a0 === r.startContainer ? r.startOffset : 0);
    var b = posOf(ix, b0, b0 === r.endContainer ? r.endOffset : b0.nodeValue.length, true);
    while (a < b && ix.s[a] === " ") a++;
    while (b > a && ix.s[b - 1] === " ") b--;
    return b > a ? { a: a, b: b } : null;
  }
  function posToRange(ix, a, b) {
    if (a < 0 || b > ix.s.length || b <= a) return null;
    var r = document.createRange();
    try { r.setStart(ix.nodes[a], ix.offs[a]); r.setEnd(ix.nodes[b - 1], ix.offs[b - 1] + 1); } catch (e) { return null; }
    return r;
  }
  function commonTail(x, y) { var n = 0; while (n < x.length && n < y.length && x[x.length - 1 - n] === y[y.length - 1 - n]) n++; return n; }
  function commonHead(x, y) { var n = 0; while (n < x.length && n < y.length && x[n] === y[n]) n++; return n; }
  function bestHit(ix, hay, q, c) {
    var best = -1, score = -1, from = 0, i, L = hay.length || 1;
    while ((i = hay.indexOf(q, from)) !== -1) {
      var sc = commonTail(hay.slice(Math.max(0, i - 48), i), c.prefix || "") + commonHead(hay.slice(i + q.length, i + q.length + 48), c.suffix || "");
      sc -= Math.abs(i / L - (c.pos || 0)) * 4; // nudge towards the old position on ties
      if (sc > score) { score = sc; best = i; }
      from = i + 1;
    }
    return best;
  }
  function locate(ix, c) {
    var q = c.quote || ""; if (!q) return null;
    var i = bestHit(ix, ix.s, q, c);
    if (i >= 0) return posToRange(ix, i, i + q.length);
    if (!ix.low) ix.low = ix.s.toLowerCase();
    i = bestHit(ix, ix.low, q.toLowerCase(), { prefix: (c.prefix || "").toLowerCase(), suffix: (c.suffix || "").toLowerCase(), pos: c.pos });
    if (i >= 0) return posToRange(ix, i, i + q.length);
    if (q.length >= 50) { // long quote edited in the middle: match its first and last words
      var head = q.slice(0, 24), tail = q.slice(-24), h = bestHit(ix, ix.s, head, c);
      if (h >= 0) {
        var t = ix.s.indexOf(tail, h + head.length);
        if (t >= 0 && t - h < q.length * 1.6) return posToRange(ix, h, t + tail.length);
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ styles */
  var css = [
    ":root{--cm-w:" + CM_W + "px;--cm-blue:#2383e2;--cm-y:rgba(255,200,0,.22);--cm-yl:rgba(232,172,0,.9);--cm-ya:rgba(255,200,0,.55)}",
    "::highlight(cm-hl){background-color:var(--cm-y);text-decoration:underline 2px var(--cm-yl);text-underline-offset:3px}",
    "::highlight(cm-act){background-color:var(--cm-ya);text-decoration:underline 2px var(--cm-yl);text-underline-offset:3px}",
    "::highlight(cm-pend){background-color:var(--cm-ya)}",
    ".cm-ui{font-family:inherit;color:var(--ink,#2a2a2a);font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased}",
    ".cm-ui *{box-sizing:border-box}",
    ".cm-ui[hidden],.cm-ui [hidden]{display:none!important}",
    /* selection bubble */
    ".cm-sel{position:fixed;z-index:60;display:flex;align-items:center;gap:2px;padding:4px;background:var(--card,#fff);border:1px solid var(--line2,#ddd);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.16)}",
    ".cm-sel button{display:flex;align-items:center;gap:6px;border:0;background:none;font:inherit;font-weight:700;font-size:13.5px;color:var(--ink,#2a2a2a);padding:6px 10px;border-radius:7px;cursor:pointer}",
    ".cm-sel button:hover{background:var(--grey-soft,#efebe3)}",
    ".cm-sel kbd{font:600 11px ui-monospace,Menlo,monospace;color:var(--muted,#888);border:0;background:none;padding:0}",
    /* margin column */
    ".cm-on .main{margin-right:calc(var(--cm-w) + 28px)}",
    ".cm-on.split-on .main{margin-right:calc(var(--pane-w) + var(--cm-w) + 28px)}",
    ".cm-on .fb{right:calc(var(--cm-w) + 40px)}",
    ".cm-on.split-on .fb{right:calc(var(--pane-w) + var(--cm-w) + 40px)}",
    ".cm-col{position:absolute;top:0;right:44px;width:var(--cm-w);z-index:20}",
    ".split-on .cm-col{right:calc(var(--pane-w) + 44px)}",
    ".cm-col .cm-card{position:absolute;left:0;right:0;transition:top .16s ease}",
    /* cards */
    ".cm-card{background:var(--card,#fff);border:1px solid var(--line,#e7e0d2);border-radius:12px;padding:11px 13px;box-shadow:0 1px 2px rgba(0,0,0,.04)}",
    ".cm-card.act{box-shadow:0 6px 22px rgba(0,0,0,.13);border-color:var(--line2,#d9d1c1)}",
    ".cm-card.res{opacity:.6}",
    ".cm-card.cm-orph{border-style:dashed}",
    ".cm-msg{position:relative}",
    ".cm-msg+.cm-msg{margin-top:12px}",
    ".cm-head{display:flex;align-items:center;gap:8px;min-width:0}",
    ".cm-av{flex:none;width:22px;height:22px;border-radius:50%;border:1px solid var(--line2,#ddd);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--muted,#777);background:var(--bg,#faf6ee)}",
    ".cm-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".cm-time{font-size:12px;color:var(--muted,#888);white-space:nowrap}",
    ".cm-body{margin:3px 0 0 30px;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".cm-quote{margin:0 0 8px;padding:1px 0 1px 9px;border-left:3px solid var(--cm-yl);color:var(--muted,#777);font-size:12.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}",
    ".cm-note{font-size:12px;color:var(--amber,#b5761b);margin:0 0 6px;font-weight:700}",
    ".cm-tools{position:absolute;top:-4px;right:-6px;display:none;gap:1px;background:var(--card,#fff);border:1px solid var(--line,#eee);border-radius:8px;padding:1px}",
    ".cm-msg:hover>.cm-tools,.cm-msg:focus-within>.cm-tools{display:flex}",
    "@media (hover:none){.cm-tools{display:flex;position:static;float:right;border:0}}",
    ".cm-tools button,.cm-ib{border:0;background:none;font:inherit;font-size:13px;color:var(--muted,#777);width:26px;height:26px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}",
    ".cm-tools button:hover,.cm-ib:hover{background:var(--grey-soft,#efebe3);color:var(--ink,#222)}",
    ".cm-more{font-size:12.5px;color:var(--muted,#888);margin:8px 0 0 30px;font-weight:600}",
    /* composer */
    ".cm-comp{display:flex;align-items:flex-start;gap:8px;margin-top:10px}",
    ".cm-card>.cm-comp:first-child{margin-top:0}",
    ".cm-comp .cm-av{margin-top:5px}",
    ".cm-field{flex:1;min-width:0}",
    ".cm-field textarea{overflow:hidden}",
    ".cm-field input,.cm-field textarea{width:100%;font:inherit;font-size:14px;color:var(--ink,#222);background:transparent;border:0;outline:0;resize:none;padding:5px 0;line-height:1.45}",
    ".cm-field input.cm-who{font-size:12.5px;font-weight:700;border-bottom:1px dashed var(--line2,#ddd);margin-bottom:2px}",
    ".cm-send{flex:none;width:28px;height:28px;margin-top:2px;border-radius:50%;border:0;background:var(--cm-blue);color:#fff;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center}",
    ".cm-send:disabled{background:var(--line2,#ccc);cursor:default}",
    ".cm-edit-bar{display:flex;gap:6px;justify-content:flex-end;margin-top:4px}",
    ".cm-btn{border:1px solid var(--line2,#ddd);background:var(--card,#fff);color:var(--ink,#222);font:inherit;font-size:12.5px;font-weight:700;padding:4px 10px;border-radius:7px;cursor:pointer}",
    ".cm-btn.pri{background:var(--cm-blue);border-color:var(--cm-blue);color:#fff}",
    /* top bar button */
    "@media (max-width:1279px){.cm-tbtn .lbl{display:none}}",
    ".cm-float .cm-n{min-width:18px;padding:0 5px;border-radius:9px;background:var(--amber-soft,#fbefd6);color:var(--amber,#b5761b);font-size:11.5px;font-weight:800;line-height:18px;text-align:center}",
    ".cm-tbtn .cm-n{min-width:18px;padding:0 5px;border-radius:9px;background:var(--amber-soft,#fbefd6);color:var(--amber,#b5761b);font-size:11.5px;font-weight:800;line-height:18px;text-align:center}",
    ".cm-float{position:fixed;bottom:18px;right:18px;z-index:50;border:1px solid var(--line2,#ddd);background:var(--card,#fff);border-radius:10px;padding:6px 10px;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08);display:flex;gap:6px;align-items:center}",
    /* side panel */
    ".cm-panel{position:fixed;top:var(--top-h,0px);right:0;bottom:0;width:min(400px,100vw);z-index:55;background:var(--bg,#faf6ee);border-left:1px solid var(--line2,#ddd);box-shadow:-10px 0 40px rgba(0,0,0,.14);display:flex;flex-direction:column}",
    ".cm-ph{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line,#eee)}",
    ".cm-ph b{flex:1;font-size:15px}",
    ".cm-tabs{display:flex;gap:4px;padding:8px 14px 0}",
    ".cm-tab{border:0;background:none;font:inherit;font-weight:700;font-size:13px;color:var(--muted,#888);padding:6px 10px;border-radius:8px;cursor:pointer}",
    ".cm-tab.on{background:var(--grey-soft,#efebe3);color:var(--ink,#222)}",
    ".cm-pb{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:10px 14px 30px}",
    ".cm-pb .cm-card+.cm-card{margin-top:10px}",
    ".cm-grp{margin:16px 0 8px;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#888)}",
    ".cm-grp:first-child{margin-top:4px}",
    ".cm-grp a{color:inherit}",
    ".cm-empty{color:var(--muted,#888);font-size:13.5px;padding:14px 2px}",
    ".cm-set{border-top:1px solid var(--line,#eee);padding:10px 14px 14px;font-size:13px;display:grid;gap:8px}",
    ".cm-set label{display:flex;align-items:center;gap:8px;cursor:pointer}",
    ".cm-set .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}",
    ".cm-set input[type=text],.cm-set input[type=password]{border:1px solid var(--line2,#ddd);border-radius:7px;padding:5px 8px;background:var(--card,#fff);flex:1;min-width:120px;font-size:13px}",
    ".cm-sync{color:var(--muted,#888);font-size:12.5px}",
    ".cm-sync.err{color:var(--red,#b83b2e)}",
    ".cm-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:70;background:#2a2a2a;color:#fff;padding:9px 14px;border-radius:10px;font-size:13.5px;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:min(560px,92vw)}",
    "@media print{.cm-ui{display:none!important}.cm-on .main{margin-right:0!important}}"
  ].join("\n");
  var st = document.createElement("style"); st.id = "cm-style"; st.textContent = css; document.head.appendChild(st);

  /* ------------------------------------------------------------ UI shells */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var col = el("div", "cm-ui cm-col"); col.setAttribute("aria-label", "Comments");
  var sel = el("div", "cm-ui cm-sel", '<button type="button" data-act="start"><span aria-hidden="true">💬</span> Comment <kbd>' + (isMac ? "⇧⌘M" : "Ctrl+Shift+M") + "</kbd></button>");
  sel.hidden = true;
  var panel = el("aside", "cm-ui cm-panel"); panel.hidden = true; panel.setAttribute("aria-label", "All comments");
  document.body.appendChild(col); document.body.appendChild(sel); document.body.appendChild(panel);

  var tbtn, tb = $(".tb");
  if (tb) {
    tbtn = el("button", "tb-btn cm-tbtn cm-ui", '<span class="ico" aria-hidden="true">💬</span><span class="lbl">Comments</span><span class="cm-n" hidden></span>');
    tbtn.type = "button";
    var help = $("#help-open", tb);
    if (help) tb.insertBefore(tbtn, help); else tb.appendChild(tbtn);
  } else {
    tbtn = el("button", "cm-ui cm-float", '<span aria-hidden="true">💬</span><span class="cm-lbl">Comments</span><span class="cm-n" hidden></span>');
    tbtn.type = "button"; document.body.appendChild(tbtn);
  }
  tbtn.title = "Comments: select text and press " + (isMac ? "⇧⌘M" : "Ctrl+Shift+M") + " to add one";
  tbtn.addEventListener("click", function () { openPanel(panel.hidden); });

  var toastT;
  function toast(msg) {
    var t = $(".cm-toast") || document.body.appendChild(el("div", "cm-ui cm-toast"));
    t.textContent = msg; t.hidden = false; clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 4200);
  }

  /* ------------------------------------------------------------ state of the visible page */
  var view = { key: "", root: null, ix: null, ranges: {}, orphans: [] };
  var active = null, pending = null, editing = null, replyOpen = {}, drafts = {};
  var mode = "margin";

  function who() { return (prefs.name || "").trim() || "Me"; }
  function initial(n) { var s = (n || "?").trim(); return esc(s ? s[0].toUpperCase() : "?"); }
  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return "Just now";
    if (s < 3600) { var m = Math.round(s / 60); return m + (m === 1 ? " minute ago" : " minutes ago"); }
    if (s < 86400) { var h = Math.round(s / 3600); return h + (h === 1 ? " hour ago" : " hours ago"); }
    var d = new Date(t), now = new Date();
    if (s < 172800 && d.getDate() !== now.getDate()) return "Yesterday";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  }

  function reanchor() {
    var key = currentKey(), r = currentRoot();
    if (key !== view.key) { active = null; editing = null; if (pending && pending.page !== key) pending = null; }
    view.key = key; view.root = r; view.ix = buildIndex(r); view.ranges = {}; view.orphans = [];
    threads(key).forEach(function (c) {
      var rg = locate(view.ix, c);
      if (rg) view.ranges[c.id] = rg; else view.orphans.push(c.id);
    });
    paint(); render();
  }

  function paint() {
    if (!HAS_HL) return;
    var hl = [], act = [];
    Object.keys(view.ranges).forEach(function (id) {
      var c = db.items[id]; if (!live(c) || (c.resolved && !prefs.showResolved)) return;
      (id === active ? act : hl).push(view.ranges[id]);
    });
    function mk(list, pr) { var h = new Highlight(); list.forEach(function (r) { h.add(r); }); h.priority = pr; return h; }
    CSS.highlights.set("cm-hl", mk(hl, 1));
    CSS.highlights.set("cm-act", mk(act, 2));
    CSS.highlights.set("cm-pend", mk(pending && pending.range ? [pending.range] : [], 3));
  }

  function visibleThreads() {
    return threads(view.key).filter(function (c) { return !c.resolved || prefs.showResolved; });
  }
  function pickMode() {
    var w = window.innerWidth;
    if (w < 1100) return "drawer";
    var navW = root.classList.contains("nav-hidden") ? 0 : (parseFloat(getComputedStyle(root).getPropertyValue("--nav-w")) || 0);
    var pane = $("#pane"), paneW = root.classList.contains("split-on") && pane ? pane.getBoundingClientRect().width : 0;
    if (!$(".tb")) navW = 0;
    return w - navW - paneW - CM_W - 28 >= 540 ? "margin" : "drawer";
  }
  function setOn(on) { if (root.classList.contains("cm-on") !== on) root.classList.toggle("cm-on", on); }

  function anchorY(rg) {
    var rects = rg.getClientRects();
    for (var i = 0; i < rects.length; i++) if (rects[i].height > 0) return rects[i].top + window.scrollY;
    var e = rg.startContainer.nodeType === 1 ? rg.startContainer : rg.startContainer.parentElement;
    while (e && !e.getClientRects().length) e = e.parentElement;
    return e ? e.getBoundingClientRect().top + window.scrollY : null;
  }
  function inClosed(rg) {
    var e = rg.startContainer.parentElement;
    return !!(e && (e.closest("details:not([open])") || e.closest(".archetype.collapsed")));
  }

  /* ------------------------------------------------------------ rendering */
  function msgHTML(c, isRoot) {
    var tools = "";
    if (isRoot) tools += '<button type="button" data-act="resolve" title="' + (c.resolved ? "Re-open" : "Resolve") + '">' + (c.resolved ? "↺" : "✓") + "</button>";
    tools += '<button type="button" data-act="edit" title="Edit">✎</button><button type="button" data-act="del" title="Delete">🗑</button>';
    var body;
    if (editing === c.id) {
      body = '<div class="cm-body"><div class="cm-field"><textarea rows="1" data-edit="' + c.id + '">' + esc(c.text) + '</textarea></div><div class="cm-edit-bar"><button type="button" class="cm-btn" data-act="edit-cancel">Cancel</button><button type="button" class="cm-btn pri" data-act="edit-save">Save</button></div></div>';
    } else body = '<div class="cm-body">' + esc(c.text) + "</div>";
    return '<div class="cm-msg" data-id="' + c.id + '"><div class="cm-tools">' + tools + '</div><div class="cm-head"><span class="cm-av">' + initial(c.author) + '</span><span class="cm-name">' + esc(c.author || "Me") + '</span><span class="cm-time" title="' + esc(new Date(c.created).toLocaleString()) + '">' + ago(c.created) + (c.edited ? " · edited" : "") + "</span></div>" + body + "</div>";
  }
  function composerHTML(kind, id) {
    var ph = kind === "reply" ? "Reply…" : "Add a comment…";
    var d = drafts[kind === "reply" ? id : "new"] || "";
    return '<div class="cm-comp" data-kind="' + kind + '"' + (id ? ' data-for="' + id + '"' : "") + '><span class="cm-av">' + initial(who()) + '</span><div class="cm-field">' +
      '<textarea rows="1" placeholder="' + ph + '">' + esc(d) + '</textarea></div><button type="button" class="cm-send" data-act="send" title="Comment (Enter)" aria-label="Send"' + (d.trim() ? "" : " disabled") + ">↑</button></div>";
  }
  function cardHTML(c, opts) {
    opts = opts || {};
    var reps = replies(c.id), h = "";
    var orphan = view.key === c.page && view.orphans.indexOf(c.id) >= 0;
    if (opts.quote || orphan) h += '<div class="cm-quote" data-act="goto" title="Go to the text">' + esc(c.quote) + "</div>";
    if (orphan) h += '<div class="cm-note">The quoted text is no longer on this page.</div>';
    else if (opts.closedNote && view.ranges[c.id] && inClosed(view.ranges[c.id])) h += '<div class="cm-note">On text inside a closed section · click to open</div>';
    h += msgHTML(c, true);
    var showAll = opts.full || active === c.id || reps.length <= 2;
    var shown = showAll ? reps : reps.slice(-1);
    if (!showAll) h += '<div class="cm-more">' + (reps.length - 1) + " more " + (reps.length - 1 === 1 ? "reply" : "replies") + "</div>";
    shown.forEach(function (r) { h += msgHTML(r, false); });
    if (!opts.compact && (active === c.id || replyOpen[c.id] || opts.full)) h += composerHTML("reply", c.id);
    return '<div class="cm-card' + (active === c.id ? " act" : "") + (c.resolved ? " res" : "") + (orphan ? " cm-orph" : "") + '" data-thread="' + c.id + '">' + h + "</div>";
  }

  function render() {
    var vis = visibleThreads();
    mode = pickMode();
    var margin = mode === "margin" && !prefs.hideMargin && (vis.length > 0 || !!pending);
    setOn(margin);
    col.hidden = !margin;
    var focused = document.activeElement, keep = null;
    if (focused && col.contains(focused) && focused.tagName === "TEXTAREA") keep = { thread: (focused.closest("[data-thread]") || {}).getAttribute && focused.closest("[data-thread]").getAttribute("data-thread"), kind: (focused.closest(".cm-comp") || {}).getAttribute ? focused.closest(".cm-comp").getAttribute("data-kind") : null, edit: focused.getAttribute("data-edit"), pos: focused.selectionStart };
    if (margin) {
      var h = "";
      if (pending) h += '<div class="cm-card act" data-thread="new">' + composerHTML("new") + "</div>";
      vis.forEach(function (c) { if (view.ranges[c.id] || view.orphans.indexOf(c.id) >= 0) h += cardHTML(c, { closedNote: true }); });
      col.innerHTML = h;
      requestAnimationFrame(layout);
    } else col.innerHTML = "";
    if (keep) restoreFocus(col, keep);
    updateCount();
    if (!panel.hidden) renderPanel();
    if (!margin && pending && panel.hidden) openPanel(true);
    autosizeAll(col);
  }
  function restoreFocus(box, k) {
    var t;
    if (k.edit) t = $('textarea[data-edit="' + k.edit + '"]', box);
    else if (k.thread) t = $('[data-thread="' + k.thread + '"] .cm-comp textarea', box);
    if (t) { t.focus(); try { t.setSelectionRange(k.pos, k.pos); } catch (e) { /* ignore */ } }
  }
  function updateCount() {
    var n = visibleThreads().length, b = $(".cm-n", tbtn);
    b.textContent = n; b.hidden = !n;
  }

  function layout() {
    if (col.hidden) return;
    var cards = $$(".cm-card", col), items = [];
    var colTop = col.getBoundingClientRect().top + window.scrollY;
    cards.forEach(function (card) {
      var id = card.getAttribute("data-thread");
      var rg = id === "new" ? pending && pending.range : view.ranges[id];
      var y = rg ? anchorY(rg) : null;
      if (y == null && view.root && view.orphans.indexOf(id) >= 0) y = view.root.getBoundingClientRect().top + window.scrollY + 24;
      if (y == null) { card.style.top = "-9999px"; return; }
      items.push({ el: card, y: y - colTop - 12, h: card.offsetHeight, act: card.classList.contains("act") });
    });
    items.sort(function (a, b) { return a.y - b.y; });
    var gap = 10, k = -1;
    for (var i = 0; i < items.length; i++) if (items[i].act) { k = i; break; }
    var top = [];
    if (k < 0) {
      for (i = 0; i < items.length; i++) top[i] = i ? Math.max(items[i].y, top[i - 1] + items[i - 1].h + gap) : items[i].y;
    } else {
      top[k] = items[k].y;
      for (i = k + 1; i < items.length; i++) top[i] = Math.max(items[i].y, top[i - 1] + items[i - 1].h + gap);
      for (i = k - 1; i >= 0; i--) top[i] = Math.min(items[i].y, top[i + 1] - items[i].h - gap);
    }
    items.forEach(function (it, j) { it.el.style.top = Math.round(top[j]) + "px"; });
  }

  /* ------------------------------------------------------------ the panel (all comments + settings) */
  var tab = "page";
  function openPanel(show) {
    panel.hidden = !show;
    if (show) renderPanel();
    else if (pending && mode === "drawer") { pending = null; paint(); }
  }
  function renderPanel() {
    var focused = document.activeElement, keep = null;
    if (focused && panel.contains(focused) && focused.tagName === "TEXTAREA") keep = { thread: focused.closest("[data-thread]") && focused.closest("[data-thread]").getAttribute("data-thread"), edit: focused.getAttribute("data-edit"), pos: focused.selectionStart };
    var scroll = $(".cm-pb", panel) ? $(".cm-pb", panel).scrollTop : 0;
    var h = '<div class="cm-ph"><span aria-hidden="true">💬</span><b>Comments</b><button type="button" class="cm-ib" data-act="close" title="Close (Esc)" aria-label="Close">✕</button></div>';
    h += '<div class="cm-tabs"><button type="button" class="cm-tab' + (tab === "page" ? " on" : "") + '" data-tab="page">This page</button><button type="button" class="cm-tab' + (tab === "all" ? " on" : "") + '" data-tab="all">All pages</button></div><div class="cm-pb">';
    if (tab === "page") {
      if (pending) h += '<div class="cm-card act" data-thread="new"><div class="cm-quote">' + esc(pending.quote) + "</div>" + composerHTML("new") + "</div>";
      var vis = visibleThreads().sort(function (a, b) { return (posKey(a) - posKey(b)); });
      if (!vis.length && !pending) h += '<div class="cm-empty">No comments on this page yet. Select any text in the lesson and press <b>Comment</b>.</div>';
      vis.forEach(function (c) { h += cardHTML(c, { quote: true, full: true }); });
    } else {
      var groups = {};
      threads().forEach(function (c) { if (c.resolved && !prefs.showResolved) return; (groups[c.page] = groups[c.page] || []).push(c); });
      var keys = Object.keys(groups).sort(function (a, b) { return a === view.key ? -1 : b === view.key ? 1 : a < b ? -1 : 1; });
      if (!keys.length) h += '<div class="cm-empty">No comments yet.</div>';
      keys.forEach(function (k) {
        h += '<div class="cm-grp"><a href="' + esc(pageHref(k)) + '" data-page="' + esc(k) + '">' + esc(pageLabel(k)) + "</a> · " + groups[k].length + "</div>";
        groups[k].sort(function (a, b) { return (a.pos || 0) - (b.pos || 0); }).forEach(function (c) { h += cardHTML(c, { quote: true, compact: k !== view.key, full: k === view.key }); });
      });
    }
    h += "</div>";
    var sy = syncInfo();
    h += '<div class="cm-set">' +
      '<label><input type="checkbox" data-pref="margin"' + (prefs.hideMargin ? "" : " checked") + "> Show comments beside the text</label>" +
      '<label><input type="checkbox" data-pref="resolved"' + (prefs.showResolved ? " checked" : "") + "> Show resolved comments</label>" +
      '<div class="row">Your name <input type="text" data-pref="name" maxlength="40" value="' + esc(prefs.name || "") + '" placeholder="Shown on your comments"></div>' +
      '<div class="cm-sync' + (sy.err ? " err" : "") + '">' + esc(sy.text) + "</div>" +
      (sy.needToken ? '<div class="row"><input type="password" data-pref="token" placeholder="GitHub token with the gist scope" autocomplete="off"><button type="button" class="cm-btn" data-act="token">Connect</button></div>' : "") +
      '<div class="row"><button type="button" class="cm-btn" data-act="export">Download backup</button><button type="button" class="cm-btn" data-act="import">Restore from file</button>' + (sy.on ? '<button type="button" class="cm-btn" data-act="syncnow">Sync now</button>' : "") + "</div></div>";
    panel.innerHTML = h;
    $(".cm-pb", panel).scrollTop = scroll;
    if (keep) restoreFocus(panel, keep);
    else if (pending && tab === "page") { var t = $('[data-thread="new"] textarea', panel); if (t) t.focus(); }
    autosizeAll(panel);
  }
  function posKey(c) { var rg = view.ranges[c.id]; var y = rg ? anchorY(rg) : null; return y == null ? 1e9 : y; }

  /* ------------------------------------------------------------ actions */
  function selectionInfo() {
    var s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    var r = s.getRangeAt(0), rt = currentRoot();
    var anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
    if (!anc || !rt.contains(anc) || anc.closest(".cm-ui,input,textarea,select,.pane")) return null;
    if (!s.toString().trim()) return null;
    return r;
  }
  function startComment() {
    var r = selectionInfo(); if (!r) return false;
    if (view.root !== currentRoot() || view.key !== currentKey()) reanchor();
    var p = rangeToPos(view.ix, r); if (!p) return false;
    var s = view.ix.s;
    pending = { page: view.key, quote: s.slice(p.a, p.b), prefix: s.slice(Math.max(0, p.a - 48), p.a), suffix: s.slice(p.b, p.b + 48), pos: p.a / (s.length || 1), range: posToRange(view.ix, p.a, p.b) };
    drafts["new"] = "";
    active = null; hideSel();
    try { window.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
    paint(); render();
    setTimeout(function () {
      var t = $('[data-thread="new"] .cm-who', col.hidden ? panel : col) || $('[data-thread="new"] textarea', col.hidden ? panel : col);
      if (t) t.focus({ preventScroll: true });
    }, 30);
    return true;
  }
  function send(comp) {
    var ta = $("textarea", comp), text = ta.value.trim(); if (!text) return;
    var nm = $(".cm-who", comp);
    if (nm && nm.value.trim()) { prefs.name = nm.value.trim(); savePrefs(); }
    var kind = comp.getAttribute("data-kind"), now = Date.now();
    if (kind === "new" && pending) {
      var c = { id: uid(), page: pending.page, quote: pending.quote, prefix: pending.prefix, suffix: pending.suffix, pos: pending.pos, text: text, author: who(), created: now, updated: now };
      db.items[c.id] = c; view.ranges[c.id] = pending.range; pending = null; drafts["new"] = ""; active = c.id;
    } else if (kind === "reply") {
      var pid = comp.getAttribute("data-for"), parent = db.items[pid]; if (!parent) return;
      var r = { id: uid(), parent: pid, page: parent.page, text: text, author: who(), created: now, updated: now };
      db.items[r.id] = r; drafts[pid] = ""; active = pid; replyOpen[pid] = true;
      if (parent.resolved) { parent.resolved = false; touch(parent); }
    }
    persist(); paint(); render();
  }
  function cancelPending() { if (!pending) return; pending = null; drafts["new"] = ""; paint(); render(); }
  function goTo(id) {
    var c = db.items[id]; if (!c) return;
    if (c.page !== view.key) {
      var href = pageHref(c.page);
      if (href.charAt(0) !== "#") { location.href = href; return; }
      pendingGo = id; location.hash = href; return;
    }
    var rg = view.ranges[id]; active = id;
    if (rg) {
      openAround(rg);
      setTimeout(function () {
        var y = anchorY(rg); if (y != null) window.scrollTo({ top: Math.max(0, y - window.innerHeight * 0.3), behavior: "smooth" });
      }, 60);
    }
    if (mode === "margin" && !prefs.hideMargin) openPanel(false);
    paint(); render();
  }
  var pendingGo = null;
  function openAround(rg) {
    var e = rg.startContainer.parentElement; if (!e) return;
    var a = e.closest(".archetype.collapsed"); if (a) { var b = $(".arch-toggle", a); if (b) b.click(); else a.classList.remove("collapsed"); }
    var d = e.closest("details");
    while (d) { d.open = true; d = d.parentElement && d.parentElement.closest("details"); }
  }

  function onAct(e, box) {
    var b = e.target.closest("[data-act]"); if (!b || !box.contains(b)) return;
    var act = b.getAttribute("data-act"), card = b.closest("[data-thread]"), msg = b.closest("[data-id]");
    var tid = card && card.getAttribute("data-thread"), mid = msg && msg.getAttribute("data-id");
    e.preventDefault(); e.stopPropagation();
    if (act === "close") { openPanel(false); return; }
    if (act === "send") { send(b.closest(".cm-comp")); return; }
    if (act === "resolve") { var c = db.items[tid]; c.resolved = !c.resolved; touch(c); if (c.resolved && active === tid) active = null; persist(); paint(); render(); toast(c.resolved ? "Resolved. Turn on “Show resolved comments” in the Comments panel to see it again." : "Re-opened."); return; }
    if (act === "edit") { editing = mid; render(); var t = $('textarea[data-edit="' + mid + '"]', box); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } return; }
    if (act === "edit-cancel") { editing = null; render(); return; }
    if (act === "edit-save") { saveEdit(box); return; }
    if (act === "del") {
      var m = db.items[mid]; if (!m) return;
      if (!confirm(m.parent ? "Delete this reply?" : "Delete this comment" + (replies(mid).length ? " and its replies?" : "?"))) return;
      m.deleted = true; m.text = ""; touch(m);
      if (!m.parent) replies(mid).forEach(function (r) { r.deleted = true; r.text = ""; touch(r); });
      if (active === mid) active = null;
      persist(); reanchor(); return;
    }
    if (act === "goto") { goTo(tid); return; }
    if (act === "export") { exportFile(); return; }
    if (act === "import") { importFile(); return; }
    if (act === "token") { var inp = $('[data-pref="token"]', panel), tk = inp && inp.value.trim(); if (tk) { var cs = lsGet(CSYNC, {}); cs.token = tk; cs.bad = false; cs.gist = ""; lsSet(CSYNC, cs); syncErr = ""; syncNow(); renderPanel(); } return; }
    if (act === "syncnow") { syncNow(); return; }
  }
  function saveEdit(box) {
    var t = $("textarea[data-edit]", box); if (!t) return;
    var c = db.items[t.getAttribute("data-edit")], v = t.value.trim();
    if (c && v && v !== c.text) { c.text = v; c.edited = true; touch(c); persist(); }
    editing = null; render();
  }

  [col, panel].forEach(function (box) {
    box.addEventListener("click", function (e) {
      onAct(e, box);
      if (e.defaultPrevented) return;
      var tabB = e.target.closest("[data-tab]");
      if (tabB) { tab = tabB.getAttribute("data-tab"); renderPanel(); return; }
      var pg = e.target.closest("a[data-page]");
      if (pg) { var href = pageHref(pg.getAttribute("data-page")); if (href.charAt(0) === "#") { e.preventDefault(); location.hash = href; } return; }
      var card = e.target.closest("[data-thread]");
      if (card && box === col) {
        var id = card.getAttribute("data-thread");
        if (id !== "new" && active !== id) {
          active = id; var rg = view.ranges[id];
          if (rg && inClosed(rg)) openAround(rg);
          paint(); render();
          setTimeout(function () { var t = $('[data-thread="' + id + '"] .cm-comp textarea', col); if (t && !e.target.closest("button,textarea,input")) t.focus({ preventScroll: true }); }, 20);
        }
      } else if (card && box === panel && !e.target.closest("button,textarea,input")) {
        var tid = card.getAttribute("data-thread"); if (tid !== "new" && db.items[tid] && db.items[tid].page !== view.key) goTo(tid);
      }
    });
    box.addEventListener("input", function (e) {
      var t = e.target;
      if (t.tagName === "TEXTAREA") {
        autosize(t);
        var comp = t.closest(".cm-comp");
        if (comp) {
          var k = comp.getAttribute("data-kind") === "reply" ? comp.getAttribute("data-for") : "new";
          drafts[k] = t.value; $(".cm-send", comp).disabled = !t.value.trim();
        }
        if (box === col) requestAnimationFrame(layout);
      }
    });
    box.addEventListener("change", function (e) {
      var p = e.target.getAttribute("data-pref");
      if (p === "margin") { prefs.hideMargin = !e.target.checked; savePrefs(); render(); }
      else if (p === "resolved") { prefs.showResolved = e.target.checked; savePrefs(); paint(); render(); }
      else if (p === "name") { prefs.name = e.target.value.trim(); savePrefs(); render(); }
    });
    box.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t.tagName === "TEXTAREA" && e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (t.hasAttribute("data-edit")) saveEdit(box); else send(t.closest(".cm-comp"));
        return;
      }
      if (t.classList && t.classList.contains("cm-who") && e.key === "Enter") { e.preventDefault(); var ta = $("textarea", t.closest(".cm-comp")); if (ta) ta.focus(); return; }
      if (e.key === "Escape") {
        e.stopPropagation();
        if (editing) { editing = null; render(); }
        else if (pending && t.closest('[data-thread="new"]')) cancelPending();
        else if (box === panel) openPanel(false);
        else { active = null; t.blur && t.blur(); paint(); render(); }
      }
    });
  });
  function autosize(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
  function autosizeAll(box) { $$("textarea", box).forEach(autosize); }

  /* ------------------------------------------------------------ selection bubble */
  function hideSel() { sel.hidden = true; }
  function showSel() {
    var r = selectionInfo(); if (!r) { hideSel(); return; }
    var rects = r.getClientRects(), b = rects.length ? rects[rects.length - 1] : r.getBoundingClientRect(), f = rects.length ? rects[0] : b;
    sel.hidden = false;
    var w = sel.offsetWidth, h = sel.offsetHeight, topBar = ($(".tb") || { getBoundingClientRect: function () { return { bottom: 0 }; } }).getBoundingClientRect().bottom;
    var touchy = window.matchMedia("(hover: none)").matches;
    var y = touchy ? b.bottom + 10 : f.top - h - 8;
    if (y < topBar + 4) y = b.bottom + 8;
    var x = Math.max(8, Math.min(window.innerWidth - w - 8, (touchy ? b.left : f.left)));
    sel.style.left = x + "px"; sel.style.top = y + "px";
  }
  sel.addEventListener("mousedown", function (e) { e.preventDefault(); });
  sel.addEventListener("click", function (e) { e.preventDefault(); startComment(); });
  var selT;
  document.addEventListener("mouseup", function (e) { if (sel.contains(e.target)) return; clearTimeout(selT); selT = setTimeout(showSel, 10); });
  document.addEventListener("keyup", function (e) { if (e.shiftKey || e.key === "Shift") { clearTimeout(selT); selT = setTimeout(showSel, 10); } });
  document.addEventListener("selectionchange", function () {
    var s = window.getSelection();
    if (!s || s.isCollapsed) { hideSel(); return; }
    if (window.matchMedia("(hover: none)").matches) { clearTimeout(selT); selT = setTimeout(showSel, 350); }
  });
  window.addEventListener("scroll", function () { if (!sel.hidden) showSel(); }, { passive: true });

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && (e.key === "m" || e.key === "M")) {
      if (startComment()) e.preventDefault();
    } else if (e.key === "Escape" && !panel.hidden && !panel.contains(e.target)) openPanel(false);
  }, true);

  /* clicking highlighted text opens its comment */
  document.addEventListener("click", function (e) {
    if (e.target.closest(".cm-ui") || e.button !== 0) return;
    var s = window.getSelection(); if (s && !s.isCollapsed) return;
    var hit = null;
    Object.keys(view.ranges).forEach(function (id) {
      if (hit) return;
      var c = db.items[id]; if (!live(c) || (c.resolved && !prefs.showResolved)) return;
      var rects = view.ranges[id].getClientRects();
      for (var i = 0; i < rects.length; i++) {
        var q = rects[i];
        if (e.clientX >= q.left && e.clientX <= q.right && e.clientY >= q.top - 2 && e.clientY <= q.bottom + 2) { hit = id; break; }
      }
    });
    if (hit) {
      if (active !== hit) { active = hit; paint(); render(); }
      if (col.hidden) { tab = "page"; openPanel(true); var card = $('[data-thread="' + hit + '"]', panel); if (card) card.scrollIntoView({ block: "center" }); }
    } else if (active && !e.target.closest("a,button,input,textarea,select,summary,label")) {
      active = null; paint(); render();
    }
  });

  /* ------------------------------------------------------------ backup file */
  function exportFile() {
    var blob = new Blob([JSON.stringify(db, null, 1)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "lesson-comments-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function importFile() {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result); if (!d || typeof d.items !== "object") throw new Error("not a comments backup");
          var before = Object.keys(db.items).length;
          db = merge(db, d); persist(); reanchor();
          toast("Restored. " + (Object.keys(db.items).length - before) + " new item(s) added; nothing was overwritten with older text.");
        } catch (err) { toast("That file isn't a comments backup."); }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  /* ------------------------------------------------------------ sync to a secret gist (same token as the Save button) */
  function merge(a, b) {
    var out = { app: APP, v: 1, items: {} };
    [a.items || {}, b.items || {}].forEach(function (src) {
      Object.keys(src).forEach(function (id) {
        var x = src[id], o = out.items[id];
        if (!x || !x.id) return;
        if (!o || (x.updated || 0) > (o.updated || 0)) out.items[id] = x;
      });
    });
    return out;
  }
  function token() {
    var cs = lsGet(CSYNC, {});
    if (cs.token && !cs.bad) return cs.token;
    var a = lsGet(APPSYNC, {});
    return a.token && !a.bad ? a.token : "";
  }
  var syncTimer = null, syncing = false, syncAgain = false, syncErr = "", syncMsg = "";
  function syncInfo() {
    var cs = lsGet(CSYNC, {}), tk = token();
    if (!tk) return { on: false, needToken: true, text: cs.bad ? "GitHub rejected the token. Paste a new one with the gist scope, or reconnect with the Save button." : "Comments are saved in this browser only. Connect GitHub with the Save button (G) or paste a token here to keep them in your account." };
    if (syncErr) return { on: true, err: true, text: syncErr };
    if (syncing) return { on: true, text: "Saving comments to GitHub…" };
    return { on: true, text: cs.savedAt ? "Comments saved to your GitHub (secret gist) " + ago(cs.savedAt).toLowerCase() + "." : "Comments will be saved to your GitHub (secret gist)." };
  }
  function gh(method, path, body, keepalive) {
    var headers = { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + token() };
    if (body) headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com" + path, { method: method, headers: headers, cache: "no-store", keepalive: !!keepalive, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { /* not JSON */ }
          if (!r.ok) { var err = new Error(j.message || ("HTTP " + r.status)); err.status = r.status; throw err; }
          return j;
        });
      });
  }
  function gistFiles(d) { var f = {}; f[GFILE] = { content: JSON.stringify({ app: APP, v: 1, items: d.items }) }; return f; }
  function findGist() {
    var cs = lsGet(CSYNC, {});
    if (cs.gist) return Promise.resolve(cs.gist);
    function page(n) {
      return gh("GET", "/gists?per_page=100&page=" + n).then(function (list) {
        var hit = (list || []).filter(function (g) { return g.files && g.files[GFILE]; })[0];
        if (hit) return hit.id;
        if (list && list.length === 100 && n < 5) return page(n + 1);
        return gh("POST", "/gists", { description: "LAW301 + LAW302 lessons: reading comments (saved by the lessons page)", public: false, files: gistFiles(db) }).then(function (g) { return g.id; });
      });
    }
    return page(1).then(function (id) { var c2 = lsGet(CSYNC, {}); c2.gist = id; lsSet(CSYNC, c2); return id; });
  }
  function readGist(id) {
    return gh("GET", "/gists/" + id).then(function (g) {
      var f = g.files && g.files[GFILE], d = null;
      try { d = f && f.content ? JSON.parse(f.content) : null; } catch (e) { d = null; }
      if (f && f.truncated && f.raw_url) return fetch(f.raw_url, { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return { items: {} }; });
      return d && d.items ? d : { items: {} };
    });
  }
  function syncNow() {
    if (!token()) return Promise.resolve();
    if (syncing) { syncAgain = true; return Promise.resolve(); }
    syncing = true; syncErr = ""; if (!panel.hidden) renderPanel();
    return findGist()
      .then(function (id) {
        return readGist(id).catch(function (e) {
          if (e.status === 404) { var c2 = lsGet(CSYNC, {}); c2.gist = ""; lsSet(CSYNC, c2); return findGist().then(readGist); }
          throw e;
        });
      })
      .then(function (remote) {
        var before = JSON.stringify(db.items), merged = merge(db, remote);
        var changedLocal = JSON.stringify(merged.items) !== before;
        db = merged; persist(true);
        if (changedLocal) reanchor();
        if (JSON.stringify(merged.items) !== JSON.stringify(remote.items || {})) return gh("PATCH", "/gists/" + lsGet(CSYNC, {}).gist, { files: gistFiles(merged) });
      })
      .then(function () { var c2 = lsGet(CSYNC, {}); c2.savedAt = Date.now(); c2.dirty = false; lsSet(CSYNC, c2); })
      .catch(function (e) {
        if (!navigator.onLine || e instanceof TypeError) syncErr = "Offline: comments are safe in this browser and will be saved to GitHub when you're back online.";
        else if (e.status === 401) { syncErr = "GitHub rejected the token. Paste a new one below."; var c2 = lsGet(CSYNC, {}); if (c2.token) { c2.bad = true; lsSet(CSYNC, c2); } }
        else if (e.status === 403 || e.status === 404) syncErr = "This token can't save gists. Use one with the gist scope.";
        else syncErr = "Couldn't save comments to GitHub: " + e.message;
      })
      .then(function () {
        syncing = false;
        if (!panel.hidden) renderPanel();
        if (syncAgain && !syncErr) { syncAgain = false; scheduleSync(500); }
      });
  }
  function scheduleSync(ms) {
    if (!token()) return;
    var c2 = lsGet(CSYNC, {}); c2.dirty = true; lsSet(CSYNC, c2);
    clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms);
  }
  document.addEventListener("visibilitychange", function () {
    var cs = lsGet(CSYNC, {});
    if (document.visibilityState === "hidden" && token() && cs.gist && cs.dirty && !syncing) {
      clearTimeout(syncTimer);
      gh("PATCH", "/gists/" + cs.gist, { files: gistFiles(db) }, true).catch(function () {});
    } else if (document.visibilityState === "visible" && token()) {
      if (!cs.savedAt || Date.now() - cs.savedAt > 60000) scheduleSync(400);
    }
  });
  window.addEventListener("online", function () { scheduleSync(500); });
  window.addEventListener("storage", function (e) {
    if (e.key === SKEY) { db = lsGet(SKEY, db); reanchor(); }
  });

  /* ------------------------------------------------------------ keep in step with the page */
  var reT = null, layT = null;
  function soon() { clearTimeout(reT); reT = setTimeout(reanchor, 200); }
  function relayout() { cancelAnimationFrame(layT); layT = requestAnimationFrame(function () { var m = pickMode(); if (m !== mode) render(); else layout(); }); }
  var watchEl = $("main") || document.body;
  new MutationObserver(function (muts) {
    var content = false, toggled = false;
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i], t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (t && t.closest && t.closest(".cm-ui")) continue;
      if (m.type === "attributes") { if (m.attributeName === "hidden") content = true; else toggled = true; }
      else content = true;
    }
    if (content) soon(); else if (toggled) relayout();
  }).observe(watchEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden", "open"] });
  new MutationObserver(relayout).observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(watchEl);
  window.addEventListener("resize", function () { relayout(); if (!sel.hidden) showSel(); });
  window.addEventListener("hashchange", function () {
    hideSel();
    setTimeout(function () {
      reanchor();
      if (pendingGo) { var id = pendingGo; pendingGo = null; setTimeout(function () { goTo(id); }, 150); }
    }, 60);
  });
  document.addEventListener("toggle", relayout, true);
  window.addEventListener("load", soon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  setInterval(function () { if (document.visibilityState === "visible") $$(".cm-time").forEach(function (t) { var m = t.closest("[data-id]"), c = m && db.items[m.getAttribute("data-id")]; if (c) t.textContent = ago(c.created) + (c.edited ? " · edited" : ""); }); }, 60000);

  reanchor();
  if (token()) setTimeout(syncNow, 1200);
})();
