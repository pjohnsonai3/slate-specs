
  /* ================= v2.0: issues, submittals, master maintenance, pre-issue check ================= */
  function ocode(s) { return s.origin || s.code; }
  function projTxt(p, s) { return SS.toText(renderSec(p, s, false)); }
  function todayStr() { return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  function dstr(t) { return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function printHtml(html) {
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0'; document.body.appendChild(f);
    f.onload = function () { setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Print failed: ' + e.message); } setTimeout(function () { f.remove(); }, 60000); }, 300); };
    f.srcdoc = html;
  }
  function copyText(t, msg) { try { navigator.clipboard.writeText(t).then(function () { toast(msg || 'Copied'); }, function () { toast('Copy failed'); }); } catch (e) { toast('Copy failed'); } }
  function libSet(code, nu) {
    var o = library[code], h = (o && o.hist) || [];
    if (o && o.body && o.body !== nu.body) h = h.concat([{ rev: o.rev || 0, title: o.title, body: o.body, at: Date.now() }]).slice(-8);
    nu.hist = h; library[code] = nu; return nu;
  }
  function expProject(p) { return Object.assign({}, p, { secDates: secDates(p) }); }

  /* ---------- issues ---------- */
  function snapshot(p) {
    var o = {}; p.sections.forEach(function (s) { if (!s.on || !s.body.trim()) return; var t = projTxt(p, s); o[s.code] = { title: s.title, text: t, h: SS.hash(t) }; }); return o;
  }
  function secDates(p) {
    var iss = arr(p.issues).slice().sort(function (a, b) { return a.at - b.at; }), out = {};
    p.sections.forEach(function (s) {
      if (!s.on || !s.body.trim()) return;
      var first = '', latest = '', prev = null;
      iss.forEach(function (i) { var x = i.secs[s.code]; if (!x) return; if (!first) first = i.date; if (prev === null || x.h !== prev) latest = i.date; prev = x.h; });
      var h = SS.hash(projTxt(p, s));
      if (!first) { first = latest = p.issueDate || ''; } else if (prev !== h) latest = p.issueDate || latest;
      out[s.code] = { issue: first, latest: latest };
    });
    return out;
  }
  function snapOf(p, id) { if (id === 'cur') return snapshot(p); var i = arr(p.issues).filter(function (x) { return x.id === id; })[0]; return i ? i.secs : {}; }
  function snapName(p, id) { if (id === 'cur') return 'Current working set'; var i = arr(p.issues).filter(function (x) { return x.id === id; })[0]; return i ? i.name + ' (' + i.date + ')' : ''; }
  function compare(p, a, b) {
    var A = snapOf(p, a), B = snapOf(p, b), codes = {}; Object.keys(A).concat(Object.keys(B)).forEach(function (c) { codes[c] = 1; });
    return Object.keys(codes).sort(SS.sortCodes).map(function (c) {
      var x = A[c], y = B[c], st, ops = [];
      if (x && !y) { st = 'removed'; ops = SS.diffLines(x.text, ''); }
      else if (!x && y) { st = 'added'; ops = SS.diffLines('', y.text); }
      else if (x.h === y.h) st = 'same';
      else { st = 'changed'; ops = SS.diffLines(x.text, y.text); }
      var ds = SS.diffStats(ops);
      return { code: c, title: (y || x).title, status: st, add: ds.add, del: ds.del, ops: ops };
    });
  }
  function issueOpts(p, sel) { return arr(p.issues).map(function (i) { return '<option value="' + i.id + '"' + (sel === i.id ? ' selected' : '') + '>' + esc(i.name) + ' – ' + esc(i.date) + '</option>'; }).join('') + '<option value="cur"' + (sel === 'cur' ? ' selected' : '') + '>Current working set</option>'; }
  function cmpModal(p) {
    var c = ui.cmp, rows = compare(p, c.a, c.b), ch = rows.filter(function (r) { return r.status !== 'same'; });
    var lab = { added: ['added', 'badge g'], removed: ['removed', 'badge r'], changed: ['revised', 'badge'], same: ['no change', 'badge n'] };
    var body = '<h2>Compare issues</h2><div class="row" style="margin-bottom:10px"><div class="fld" style="margin:0"><label>From</label><select data-cmpa>' + issueOpts(p, c.a) + '</select></div><div class="fld" style="margin:0"><label>To</label><select data-cmpb>' + issueOpts(p, c.b) + '</select></div></div>' +
      '<div class="small muted" style="margin-bottom:8px">' + ch.length + ' of ' + rows.length + ' sections differ.</div><style>' + SS.REDLINE_CSS + '</style><div style="max-height:56vh;overflow:auto">' +
      (rows.map(function (r) {
        var l = lab[r.status], head = '<span class="c small muted" style="width:60px;display:inline-block">' + esc(r.code) + '</span><b>' + esc(r.title) + '</b> <span class="' + l[1] + '">' + l[0] + '</span>' + (r.status === 'same' ? '' : ' <span class="small muted">+' + r.add + ' / −' + r.del + ' lines</span>');
        return r.status === 'same' ? '<div style="padding:6px 0;border-bottom:1px solid var(--line2)">' + head + '</div>' : '<details style="padding:6px 0;border-bottom:1px solid var(--line2)"><summary>' + head + '</summary><div style="margin-top:6px;border-radius:10px;background:var(--inset);padding:6px 0">' + SS.redlineHtml(r.ops, 2) + '</div></details>';
      }).join('') || '<div class="empty">No sections.</div>') + '</div>' +
      '<div class="mfoot"><button class="btn" data-act="cmpcopy">Copy addendum summary</button><button class="btn pri" data-act="cmpprint">Print redline (PDF)</button><button class="btn" data-act="closemodal">Close</button></div>';
    modal(body, true);
  }
  function cmpSummary(p) {
    var c = ui.cmp, ch = compare(p, c.a, c.b).filter(function (r) { return r.status !== 'same'; });
    var L = [(p.name || 'Project') + ' – changes from ' + snapName(p, c.a) + ' to ' + snapName(p, c.b), ''];
    ch.forEach(function (r) { L.push('Section ' + r.code + ' – ' + r.title + ': ' + (r.status === 'added' ? 'ADDED' : r.status === 'removed' ? 'DELETED' : 'REVISED') + (r.status === 'changed' ? ' (+' + r.add + ' / −' + r.del + ' lines)' : '')); });
    if (!ch.length) L.push('No changes.'); return L.join('\n');
  }
  function cmpPrint(p) {
    var c = ui.cmp, ch = compare(p, c.a, c.b).filter(function (r) { return r.status !== 'same'; });
    var h = '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:letter;margin:.7in}body{font:11px/1.45 Arial,sans-serif;color:#111}h1{font-size:15px;margin:0 0 4px}h2{font-size:12px;margin:18px 0 6px;border-bottom:1px solid #000;padding-bottom:3px;page-break-after:avoid}.m{color:#555;margin-bottom:10px}' + SS.REDLINE_CSS + '.rl-l{font:10px/1.45 Arial,sans-serif}</style></head><body><h1>' + esc(p.name || 'Project') + ' – Redline</h1><div class="m">' + esc(snapName(p, c.a)) + ' → ' + esc(snapName(p, c.b)) + '</div>';
    h += '<div><b>Summary</b><pre style="font:11px/1.5 Arial;white-space:pre-wrap">' + esc(cmpSummary(p)) + '</pre></div>';
    ch.forEach(function (r) { h += '<h2>SECTION ' + esc(r.code) + ' – ' + esc(r.title.toUpperCase()) + ' (' + (r.status === 'changed' ? 'revised' : r.status) + ')</h2>' + SS.redlineHtml(r.ops, 3); });
    printHtml(h + '</body></html>');
  }
  function freezeModal(p) {
    var chk = issueCheck(p), names = ['Schematic Design', 'Design Development', 'Permit Set', 'Bid Set', 'Addendum No. ' + (arr(p.issues).filter(function (i) { return /^addendum/i.test(i.name); }).length + 1), 'Bulletin No. 1', 'Issued for Construction', 'Released for Construction'];
    modal('<h2>Freeze an issue</h2><div class="small muted" style="margin-bottom:10px">Saves a snapshot of every included section as it reads now. You can compare any two snapshots later, print redlines for addenda, and the table of contents uses the snapshot dates.</div>' +
      (chk.block.length ? '<div class="panel" style="background:var(--red-bg);color:var(--red)">' + chk.block.length + ' open problem' + (chk.block.length > 1 ? 's' : '') + ' in the pre-issue check. You can still freeze, but review them first.</div>' : '') +
      '<div class="fld"><label>Issue name</label><input type="text" id="isname" list="isnames" value="' + esc(names[3]) + '"><datalist id="isnames">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></div>' +
      '<div class="two"><div class="fld"><label>Issue date</label><input type="text" id="isdate" value="' + esc(todayStr()) + '"></div><div class="fld"><label>Note (optional)</label><input type="text" id="isnote" placeholder="e.g. Response to RFI 12"></div></div>' +
      '<label class="small"><input type="checkbox" id="isset" checked> Also set this as the project’s issue phase and date (shows in headers and cover)</label>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" data-act="isfreeze">Freeze issue</button></div>');
  }
  function issuesHtml(p) {
    var iss = arr(p.issues).slice().sort(function (a, b) { return a.at - b.at; });
    var rows = iss.map(function (i, k) {
      var prev = iss[k - 1], n = Object.keys(i.secs).length, chg = prev ? compare(p, prev.id, i.id).filter(function (r) { return r.status !== 'same'; }).length : null;
      return '<tr><td><b>' + esc(i.name) + '</b>' + (i.note ? '<div class="small muted">' + esc(i.note) + '</div>' : '') + '</td><td>' + esc(i.date) + '</td><td>' + n + ' sections' + (chg !== null ? ' • ' + chg + ' changed' : '') + '</td><td style="text-align:right;white-space:nowrap">' + (prev ? '<button class="btn sm" data-act="cmpopen" data-a="' + prev.id + '" data-b="' + i.id + '">vs previous</button> ' : '') + '<button class="btn sm" data-act="cmpopen" data-a="' + i.id + '" data-b="cur">vs current</button> <button class="btn sm danger" data-act="isdel" data-id="' + i.id + '">Delete</button></td></tr>';
    }).join('');
    return '<div class="panel"><div class="row"><h2 style="margin:0">Issues &amp; addenda</h2><div class="sp"></div><button class="btn pri" data-act="isnew">+ Freeze issue</button>' + (iss.length ? '<button class="btn" data-act="cmpopen" data-a="' + iss[iss.length - 1].id + '" data-b="cur">Changes since last issue</button>' : '') + '</div>' +
      '<div class="small muted" style="margin:6px 0 8px">Freeze the set at Bid, Addendum, Bulletin or Released for Construction. Each freeze records what every section said that day.</div>' +
      (rows ? '<table class="tbl"><tr><th>Issue</th><th>Date</th><th>Contents</th><th></th></tr>' + rows + '</table>' : '<div class="small muted">No issues frozen yet.</div>') + '</div>';
  }

  /* ---------- pre-issue check ---------- */
  function issueCheck(p) {
    var block = [], warn = [];
    var need = [['name', 'project name'], ['number', 'project number'], ['owner', 'owner'], ['address', 'address'], ['cityState', 'city and state'], ['phase', 'issue phase'], ['issueDate', 'issue date']].filter(function (f) { return !str(p[f[0]]); });
    if (need.length) warn.push({ code: '', text: 'Project information missing: ' + need.map(function (f) { return f[1]; }).join(', ') + '.', go: 'info' });
    p.sections.forEach(function (s) {
      if (!s.on) return;
      if (!s.body.trim()) { block.push({ code: s.code, text: 'Included but has no text.' }); return; }
      var r = renderSec(p, s), br = r.flags - r.unresolved;
      if (r.unresolved) block.push({ code: s.code, text: r.unresolved + ' unanswered: ' + Object.keys(r.unresolvedKeys).slice(0, 4).map(function (k) { return r.unresolvedKeys[k]; }).join(', ') + (r.unresolved > 4 ? '…' : '') });
      if (br > 0) block.push({ code: s.code, text: br + ' open decision' + (br > 1 ? 's' : '') + ' still in [brackets].' });
      if (s.status !== 'final') warn.push({ code: s.code, text: 'Status is “' + (s.status === 'review' ? 'In review' : 'Draft') + '”, not Final.' });
      var lib = library[ocode(s)]; if (lib && lib.rev > (s.libRev || 0)) warn.push({ code: s.code, text: 'The library has a newer revision of this section.' });
      r.refMissing.forEach(function (c) { warn.push({ code: s.code, text: 'Refers to Section ' + c + ', which is not in this project.' }); });
    });
    arr(p.checks).filter(function (c) { return !c.done; }).forEach(function (c) { if (c.sev === 'conflict') block.push({ code: c.code, text: 'Coordination conflict: ' + c.text }); else if (c.sev === 'gap') warn.push({ code: c.code, text: 'Coordination gap: ' + c.text }); });
    return { block: block, warn: warn };
  }
  function checkItem(x) { return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--line2)">' + (x.code ? '<a href="#" data-act="gotosec" data-code="' + esc(x.code) + '" style="color:inherit;font-weight:600;width:60px">' + esc(x.code) + '</a>' : '<span style="width:60px"></span>') + '<span style="flex:1;min-width:200px">' + esc(x.text) + '</span></div>'; }
  function checkHtml(p) {
    var c = issueCheck(p), ok = !c.block.length && !c.warn.length;
    return '<div class="panel"><div class="row"><h2 style="margin:0">Pre-issue check</h2>' + (c.block.length ? '<span class="badge r">' + c.block.length + ' to fix</span>' : '<span class="badge g">ready</span>') + (c.warn.length ? '<span class="badge">' + c.warn.length + ' to review</span>' : '') + '<div class="sp"></div><button class="btn sm" data-act="chkcopy">Copy report</button></div>' +
      (ok ? '<div class="small muted" style="margin-top:8px">Nothing open. Every included section has text, no brackets, no unanswered questions, and is marked Final.</div>' : '') +
      (c.block.length ? '<div style="margin-top:10px"><b class="small" style="color:var(--red)">MUST FIX BEFORE ISSUING</b>' + c.block.map(checkItem).join('') + '</div>' : '') +
      (c.warn.length ? '<details style="margin-top:10px"' + (c.block.length ? '' : ' open') + '><summary class="small"><b>REVIEW (' + c.warn.length + ')</b></summary>' + c.warn.map(checkItem).join('') + '</details>' : '') + '</div>';
  }
  function checkText(p) {
    var c = issueCheck(p), L = ['Pre-issue check – ' + (p.name || 'Project'), ''];
    L.push('MUST FIX (' + c.block.length + ')'); c.block.forEach(function (x) { L.push('- ' + (x.code ? x.code + ': ' : '') + x.text); });
    L.push('', 'REVIEW (' + c.warn.length + ')'); c.warn.forEach(function (x) { L.push('- ' + (x.code ? x.code + ': ' : '') + x.text); });
    return L.join('\n');
  }
  function viewExport(p) {
    var h = viewExport0(p).replace('<h2>Pre-issue check</h2>', '<h2>Sections at a glance</h2>');
    return h.replace('<div class="wrap">', '<div class="wrap">' + checkHtml(p) + issuesHtml(p) + wordPanel(p) + archivePanel(p));
  }

  /* ---------- submittal register ---------- */
  function subKey(x) { return x.no + '|' + SS.hash(x.desc); }
  var SUB_STATUS = ['Not started', 'Requested', 'Received', 'Under review', 'Approved', 'Approved as noted', 'Revise & resubmit', 'Rejected', 'Closed'];
  function subList(p) { return SS.submittals(renderedFor(p, 'all', false)); }
  function viewSubmittals(p) {
    var l = subList(p), st = p.subStatus || {}, f = ui.subF || '';
    var shown = l.filter(function (x) { return !f || x.type === f || x.code === f || x.action === f; });
    var types = {}; l.forEach(function (x) { types[x.type] = (types[x.type] || 0) + 1; });
    var secs = {}; l.forEach(function (x) { secs[x.code] = x.sectionTitle; });
    var rows = shown.map(function (x) {
      var k = subKey(x), v = st[k] || 'Not started';
      return '<tr><td style="white-space:nowrap">' + esc(x.no) + '</td><td>' + esc(x.type) + '</td><td><span class="badge ' + (x.action === 'Action' ? '' : 'n') + '">' + x.action + '</span></td><td>' + esc(x.desc) + (x.details.length ? '<div class="small muted">' + esc(x.details.join(' • ')).slice(0, 400) + '</div>' : '') + '<div class="small muted">' + esc(x.article) + '</div></td><td><select data-subst="' + esc(k) + '" style="padding:4px 8px;border-radius:8px">' + SUB_STATUS.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></td></tr>';
    }).join('');
    return '<div class="wrap" style="max-width:1200px"><div class="row"><div><h1>Submittal register</h1><div class="muted">Built from the Submittals, Warranty, Mock-up and Closeout articles in your included sections. It updates as the specs change.</div></div><div class="sp"></div><button class="btn" data-act="subcopy">Copy</button><button class="btn pri" data-act="subcsv">Download CSV (Excel)</button></div>' +
      '<div class="row" style="margin:14px 0 10px"><select data-subf style="padding:6px 12px;border-radius:999px"><option value="">All (' + l.length + ')</option><option' + (f === 'Action' ? ' selected' : '') + ' value="Action">Action submittals</option><option' + (f === 'Informational' ? ' selected' : '') + ' value="Informational">Informational</option>' + Object.keys(types).map(function (t) { return '<option' + (f === t ? ' selected' : '') + ' value="' + esc(t) + '">' + esc(t) + ' (' + types[t] + ')</option>'; }).join('') + Object.keys(secs).sort(SS.sortCodes).map(function (c) { return '<option' + (f === c ? ' selected' : '') + ' value="' + esc(c) + '">Section ' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="panel">' + (rows ? '<table class="tbl"><tr><th>No.</th><th>Type</th><th></th><th>Requirement</th><th style="width:160px">Status</th></tr>' + rows + '</table>' : '<div class="empty">' + (l.length ? 'Nothing matches this filter.' : 'No submittals found yet. Sections need text with a SUBMITTALS article.') + '</div>') + '</div></div>';
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function subCsv(p) {
    var st = p.subStatus || {}, L = [['Submittal No.', 'Spec Section', 'Section Title', 'Article', 'Type', 'Action / Informational', 'Requirement', 'Details', 'Status'].join(',')];
    subList(p).forEach(function (x) { L.push([x.no, x.code, x.sectionTitle, x.article, x.type, x.action, x.desc, x.details.join(' | '), st[subKey(x)] || 'Not started'].map(csvCell).join(',')); });
    return L.join('\r\n');
  }

  /* ---------- master maintenance ---------- */
  function diffModal(title, aLab, aTxt, bLab, bTxt) {
    var ops = SS.diffLines(aTxt, bTxt), ds = SS.diffStats(ops);
    modal('<h2>' + esc(title) + '</h2><div class="small muted" style="margin-bottom:8px"><span class="badge r">− ' + esc(aLab) + '</span> <span class="badge g">+ ' + esc(bLab) + '</span> • ' + ds.add + ' lines added, ' + ds.del + ' removed</div><style>' + SS.REDLINE_CSS + '</style><div style="max-height:60vh;overflow:auto;border-radius:12px;background:var(--inset);padding:6px 0">' + (ds.changed ? SS.redlineHtml(ops, 3) : '<div class="empty">No differences.</div>') + '</div><div class="mfoot"><button class="btn" data-act="closemodal">Close</button></div>', true);
  }
  function libHistPanel(code) {
    var L = library[code]; if (!L || !arr(L.hist).length) return '';
    return '<div class="panel"><h2>History</h2><div class="small muted" style="margin-bottom:6px">Previous versions of this master section. Current is rev ' + (L.rev || 0) + '.</div>' + L.hist.slice().reverse().map(function (h, i) { var idx = L.hist.length - 1 - i; return '<div class="row" style="padding:4px 0"><span>rev ' + (h.rev || 0) + ' • ' + dstr(h.at) + '</span><div class="sp"></div><button class="btn sm" data-act="libdiff" data-i="' + idx + '">Compare to current</button><button class="btn sm" data-act="librestore" data-i="' + idx + '">Restore</button></div>'; }).join('') + '</div>';
  }
  function reuseModal(p) {
    var others = projects.filter(function (x) { return x.id !== p.id && x.sections.some(function (s) { return s.body.trim(); }); });
    if (!others.length) return toast('No other projects with sections to copy from yet.');
    ui.reuseP = ui.reuseP && others.some(function (x) { return x.id === ui.reuseP; }) ? ui.reuseP : others[0].id;
    var src = projects.filter(function (x) { return x.id === ui.reuseP; })[0];
    modal('<h2>Reuse sections from another project</h2><div class="fld"><label>Copy from</label><select data-reusep>' + others.map(function (x) { return '<option value="' + x.id + '"' + (x.id === ui.reuseP ? ' selected' : '') + '>' + esc(x.name || 'Untitled') + '</option>'; }).join('') + '</select></div>' +
      '<div style="max-height:44vh;overflow:auto">' + src.sections.filter(function (s) { return s.body.trim(); }).map(function (s) { var have = p.sections.some(function (x) { return x.code === s.code; }); return '<label class="sec" style="cursor:pointer"><input type="checkbox" data-reuse="' + esc(s.code) + '"><span class="c">' + esc(s.code) + '</span><span class="t">' + esc(s.title) + '</span>' + (have ? '<span class="badge">replaces</span>' : '<span class="badge g">new</span>') + '</label>'; }).join('') + '</div>' +
      '<div class="small" style="margin-top:8px"><label><input type="checkbox" id="reuseans" checked> Copy answers and notes too (otherwise answers start blank)</label></div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" data-act="reusego">Copy selected</button></div>');
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj(), s = curSec();
    if (act === 'isnew') freezeModal(p);
    else if (act === 'isfreeze') {
      var nm = ($('#isname').value || '').trim(); if (!nm) return toast('Give the issue a name.');
      var dt = ($('#isdate').value || '').trim() || todayStr();
      p.issues = arr(p.issues); p.issues.push({ id: SS.uid(), name: nm, date: dt, note: ($('#isnote').value || '').trim(), at: Date.now(), secs: snapshot(p) });
      if ($('#isset').checked) { p.phase = nm; p.issueDate = dt; }
      saveProjects(); closeModal(); render(); toast('Frozen: ' + nm);
    }
    else if (act === 'isdel') { if (confirm('Delete this frozen issue? The current working set is not affected.')) { p.issues = arr(p.issues).filter(function (i) { return i.id !== el.dataset.id; }); saveProjects(); render(); } }
    else if (act === 'cmpopen') { ui.cmp = { a: el.dataset.a, b: el.dataset.b }; cmpModal(p); }
    else if (act === 'cmpcopy') copyText(cmpSummary(p), 'Addendum summary copied');
    else if (act === 'cmpprint') cmpPrint(p);
    else if (act === 'chkcopy') copyText(checkText(p), 'Report copied');
    else if (act === 'gotosec') { e.preventDefault(); ui.tab = 'sections'; ui.code = el.dataset.code; render(); }
    else if (act === 'subcsv') { var b = new Blob(['﻿' + subCsv(p)], { type: 'text/csv;charset=utf-8' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = ((p.number ? p.number + ' ' : '') + (p.name || 'Project') + ' - Submittal Register.csv').replace(/[\\/:*?"<>|]/g, ''); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
    else if (act === 'subcopy') copyText(subCsv(p).replace(/\r\n/g, '\n'), 'Register copied (CSV text)');
    else if (act === 'cmplib') { var L = library[ocode(s)]; if (!L) return toast('No library version of this section.'); diffModal('Project vs library – ' + s.code, 'this project', s.body, 'library rev ' + (L.rev || 0), L.body); }
    else if (act === 'libdiff') { var LL = library[ui.libCode], hh = LL.hist[+el.dataset.i]; diffModal('Library history – ' + ui.libCode, 'rev ' + hh.rev, hh.body, 'current rev ' + LL.rev, LL.body); }
    else if (act === 'librestore') { var L5 = library[ui.libCode], h5 = L5.hist[+el.dataset.i]; if (confirm('Restore rev ' + h5.rev + '? The current text is kept in history as a new revision.')) { libSet(ui.libCode, { code: ui.libCode, title: h5.title || L5.title, questions: L5.questions, body: h5.body, status: 'reviewed', rev: (L5.rev || 0) + 1, hist: L5.hist }); saveLibrary(); render(); toast('Restored'); } }
    else if (act === 'renum') {
      var nc = prompt('New section number (for example 09 261). References to this section in other sections follow the new number.', s.code); if (!nc) return; nc = nc.trim().replace(/^(\d\d)(\d{3,4})$/, '$1 $2');
      if (!/^\d\d \d{3,4}$/.test(nc)) return toast('Use the format 09 260.'); if (nc !== s.code && p.sections.some(function (x) { return x.code === nc; })) return toast('That number is already used in this project.');
      var nt = prompt('Section title:', s.title); if (nt === null) return;
      var old = s.code; s.origin = s.origin || old; s.code = nc; s.title = nt.trim() || s.title;
      arr(p.checks).forEach(function (c) { if (c.code === old) c.code = nc; });
      p.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); }); ui.code = nc; saveProjects(); render(); toast('Renumbered. References updated.');
    }
    else if (act === 'reuse') reuseModal(p);
    else if (act === 'reusego') {
      var src = projects.filter(function (x) { return x.id === ui.reuseP; })[0], keepAns = $('#reuseans').checked, n = 0;
      [].forEach.call(document.querySelectorAll('[data-reuse]:checked'), function (c) {
        var o = src.sections.filter(function (x) { return x.code === c.dataset.reuse; })[0]; if (!o) return;
        var nu = clone(o); nu.on = true; nu.status = 'draft'; if (!keepAns) { nu.answers = {}; nu.aiKeys = []; nu.notes = ''; }
        var i = p.sections.findIndex(function (x) { return x.code === nu.code; }); if (i >= 0) p.sections[i] = nu; else p.sections.push(nu); n++;
      });
      p.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); }); saveProjects(); closeModal(); render(); toast('Copied ' + n + ' section' + (n === 1 ? '' : 's'));
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, p = proj();
    if (t.dataset.subst !== undefined) { p.subStatus = p.subStatus || {}; p.subStatus[t.dataset.subst] = t.value; saveProjects(); }
    else if (t.dataset.subf !== undefined) { ui.subF = t.value; render(); }
    else if (t.dataset.cmpa !== undefined || t.dataset.cmpb !== undefined) { if (t.dataset.cmpa !== undefined) ui.cmp.a = t.value; else ui.cmp.b = t.value; cmpModal(p); }
    else if (t.dataset.reusep !== undefined) { ui.reuseP = t.value; reuseModal(p); }
  });

  /* ================= v2.2: standards table, auto References, manufacturers ================= */
  function stds() { if (!Array.isArray(settings.standards)) { settings.standards = clone(SS.STANDARDS_SEED || []); saveSettings(); } return settings.standards; }
  var STD_ORG = { ASTM: 'ASTM International', NFPA: 'National Fire Protection Association (NFPA)', ANSI: 'American National Standards Institute (ANSI)', UL: 'Underwriters Laboratories (UL)', CRI: 'Carpet and Rug Institute (CRI)', ISO: 'International Organization for Standardization (ISO)', ICC: 'International Code Council (ICC)', AWI: 'Architectural Woodwork Institute (AWI)', BHMA: 'Builders Hardware Manufacturers Association (BHMA)', WDMA: 'Window and Door Manufacturers Association (WDMA)', SMACNA: 'Sheet Metal and Air Conditioning Contractors National Association (SMACNA)', NAAMM: 'National Association of Architectural Metal Manufacturers (NAAMM)', ASHRAE: 'ASHRAE' };
  var STD_RE = /\b(ASTM|NFPA|UL|CRI|ISO|AWI|BHMA|ICC|SMACNA|WDMA|NAAMM|ASHRAE|ANSI(?:\/[A-Z]+)?)\s+((?:[A-Z]{1,3} ?)?\d[\w.\-\/]*)/g;
  function stdKey(org, no) { return (org + ' ' + String(no).replace(/\s/g, '')).toUpperCase(); }
  function scanStds(text) {
    var found = {}, m, re = new RegExp(STD_RE.source, 'g');
    while ((m = re.exec(text))) {
      var org = m[1], no = m[2].replace(/[.,;:)\]]+$/, '').replace(/\s/g, '');
      if (org === 'ASTM') no = no.replace(/-\d{2}(?:\d{2})?[a-z]?$/i, '');
      if (!/\d/.test(no)) continue; found[stdKey(org, no)] = { org: org, no: no };
    }
    return Object.keys(found).map(function (k) { return found[k]; });
  }
  function natCmp(a, b) { return a.no.replace(/\d+/g, function (n) { return ('0000' + n).slice(-5); }) < b.no.replace(/\d+/g, function (n) { return ('0000' + n).slice(-5); }) ? -1 : 1; }
  function refsBody(body) {
    var L = String(body || '').replace(/\r/g, '').split('\n'), i, ps = -1, pe = L.length;
    for (i = 0; i < L.length; i++) if (/^# /.test(L[i])) { if (ps < 0) ps = i; else { pe = i; break; } }
    if (ps < 0) return null;
    var rs = -1, re = -1;
    for (i = ps + 1; i < pe; i++) if (/^## .*\bREFERENCE/i.test(L[i])) { rs = i; re = pe; for (var j = i + 1; j < pe; j++) if (/^##? /.test(L[j])) { re = j; break; } break; }
    var rest = rs >= 0 ? L.slice(0, rs).concat(L.slice(re)) : L.slice(), at = rs;
    if (rs < 0) { var n = 0; at = pe; for (i = ps + 1; i < pe; i++) if (/^## /.test(L[i]) && ++n === 2) { at = i; break; } }
    var found = scanStds(rest.join('\n')), tab = {}; stds().forEach(function (t) { tab[stdKey(t.org, t.no)] = t; });
    if (!found.length) return { none: true };
    var byOrg = {}, order = []; found.forEach(function (f) { if (!byOrg[f.org]) { byOrg[f.org] = []; order.push(f.org); } byOrg[f.org].push(f); });
    var out = ['## REFERENCES'], missing = 0;
    order.sort().forEach(function (o) {
      out.push('1: ' + (STD_ORG[o] || o) + ':');
      byOrg[o].sort(natCmp).forEach(function (f) {
        var t = tab[stdKey(f.org, f.no)], ttl = t && t.title ? t.title.replace(/\.$/, '') : '';
        if (!ttl) missing++;
        out.push('2: ' + f.org + ' ' + f.no + (t && t.ed ? '-' + t.ed : '') + ' ' + (ttl ? ttl + '.' : '[Title of ' + f.org + ' ' + f.no + ']'));
      });
    });
    rest.splice.apply(rest, [at, 0].concat(out));
    return { body: rest.join('\n'), n: found.length, missing: missing, replaced: rs >= 0 };
  }
  function stdPanel() {
    var q = (ui.stdQ || '').toLowerCase(), all = stds(), idx = [];
    all.forEach(function (t, i) { if (!q || (t.org + ' ' + t.no + ' ' + t.title).toLowerCase().indexOf(q) >= 0) idx.push(i); });
    var rows = idx.slice(0, 80).map(function (i) { var t = all[i]; return '<tr><td class="small" style="white-space:nowrap">' + esc(t.org) + ' ' + esc(t.no) + '</td><td><input type="text" data-stdf="title" data-i="' + i + '" value="' + esc(t.title) + '" style="width:100%;padding:4px 6px"></td><td><input type="text" data-stdf="ed" data-i="' + i + '" value="' + esc(t.ed || '') + '" style="width:60px;padding:4px 6px" placeholder="—"></td><td><button class="btn sm danger" data-act="stddel" data-i="' + i + '">✕</button></td></tr>'; }).join('');
    return '<div class="panel"><h2>Reference standards</h2><div class="small muted" style="margin-bottom:8px">Your own list. Each section’s “Build References” button finds the standards cited in its text and writes the References article from this table. It started with the standards in the Perlant manual. Edition is blank by default (your manuals say to comply with the edition in effect at the Contract Documents date); type one, like 20, to print ASTM E84-20. Nothing here is checked against ASTM, so confirm editions yourself.</div>' +
      '<div class="row" style="margin-bottom:8px"><input type="text" id="stdq" placeholder="Search ' + all.length + ' standards" value="' + esc(ui.stdQ || '') + '" style="flex:1;padding:6px 10px"></div>' +
      '<div style="max-height:320px;overflow:auto"><table class="tbl"><tr><th>Standard</th><th>Title</th><th>Ed.</th><th></th></tr>' + (rows || '<tr><td colspan="4" class="muted">No matches.</td></tr>') + '</table></div>' + (idx.length > 80 ? '<div class="small muted">Showing 80 of ' + idx.length + '. Search to narrow.</div>' : '') +
      '<div class="row" style="margin-top:10px"><input type="text" id="stdorg" placeholder="Org (ASTM)" style="width:90px;padding:6px"><input type="text" id="stdno" placeholder="No. (E84)" style="width:100px;padding:6px"><input type="text" id="stdtitle" placeholder="Title" style="flex:1;padding:6px"><button class="btn sm" data-act="stdadd">Add</button></div></div>';
  }
  var viewSettings0 = viewSettings;
  viewSettings = function () { var h = viewSettings0(), i = h.lastIndexOf('</div>'); return h.slice(0, i) + stdPanel() + h.slice(i); };

  /* ---- manufacturers / basis of design, read from the uploaded finish + hardware specs ---- */
  function mfrRows(p) {
    var rows = [], seen = {};
    function add(m, prod, cat, src) { m = str(m).trim(); if (!m) return; var k = (m + '|' + prod + '|' + cat).toLowerCase(); if (seen[k]) return; seen[k] = 1; rows.push({ mfr: m, product: str(prod).trim(), cat: str(cat).trim(), src: src }); }
    finSrcs(p).forEach(function (s) {
      arr(s.data.finishes).forEach(function (f) { add(f.manufacturer, f.product, f.category, 'Finish ' + (f.tag || '')); });
      arr(s.data.hardwareSets).forEach(function (h) { arr(h.items).forEach(function (i) { add(i.manufacturer, i.model, i.item, 'Hardware ' + (h.set || '')); }); });
    });
    return rows.sort(function (a, b) { return a.mfr.toLowerCase() < b.mfr.toLowerCase() ? -1 : a.mfr.toLowerCase() > b.mfr.toLowerCase() ? 1 : 0; });
  }
  function mfrPanel(p) {
    var rows = mfrRows(p); if (!rows.length) return '';
    var n = {}; rows.forEach(function (r) { n[r.mfr] = 1; });
    return '<div class="panel"><h2>Manufacturers and basis of design</h2><div class="small muted" style="margin-bottom:8px">' + Object.keys(n).length + ' manufacturers, ' + rows.length + ' products, read from your uploaded finish and hardware specs. In a section, “Insert manufacturers” adds the ones you pick.</div><div style="max-height:300px;overflow:auto"><table class="tbl"><tr><th>Manufacturer</th><th>Product / model</th><th>Category / item</th><th>From</th></tr>' + rows.map(function (r) { return '<tr><td>' + esc(r.mfr) + '</td><td>' + esc(r.product) + '</td><td>' + esc(r.cat) + '</td><td class="small muted">' + esc(r.src) + '</td></tr>'; }).join('') + '</table></div></div>';
  }
  var viewSources0 = viewSources;
  viewSources = function (p) { var h = viewSources0(p), k = h.indexOf('<div class="panel"><h2>Sheet index</h2>'); return k < 0 ? h : h.slice(0, k) + mfrPanel(p) + h.slice(k); };
  function mfrModal(p) {
    var rows = mfrRows(p); if (!rows.length) return toast('No manufacturers yet. Upload finish or hardware specs on the Sources tab.');
    modal('<h2>Insert manufacturers</h2><div class="small muted" style="margin-bottom:8px">Adds a MANUFACTURERS article at the start of PART 2 listing the ones you tick. Edit the wording afterward.</div><div style="max-height:46vh;overflow:auto">' + rows.map(function (r, i) { return '<label class="sec" style="cursor:pointer"><input type="checkbox" data-mfr="' + i + '"><span class="t">' + esc(r.mfr) + (r.product ? ' – ' + esc(r.product) : '') + '</span><span class="small muted">' + esc(r.cat) + '</span></label>'; }).join('') + '</div><div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" data-act="mfrgo">Insert</button></div>');
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj(), s = curSec();
    if (act === 'buildrefs') {
      var r = refsBody(s.body); if (!r) return toast('This section has no PARTs yet.'); if (r.none) return toast('No ASTM, NFPA, ANSI or similar standards found in this section’s text.');
      if (!confirm('Found ' + r.n + ' standard' + (r.n > 1 ? 's' : '') + (r.missing ? ' (' + r.missing + ' not in your Settings table, left as [Title] to fill in)' : '') + '. ' + (r.replaced ? 'This replaces the existing References article.' : 'This adds a References article to PART 1.') + ' Continue?')) return;
      s.body = r.body; saveProjects(); render(); toast('References built');
    }
    else if (act === 'stdadd') {
      var o = ($('#stdorg').value || '').trim().toUpperCase(), n = ($('#stdno').value || '').trim().replace(/\s/g, ''), t = ($('#stdtitle').value || '').trim();
      if (!o || !n) return toast('Enter the organization and number.'); if (stds().some(function (x) { return stdKey(x.org, x.no) === stdKey(o, n); })) return toast('Already in the list.');
      stds().push({ org: o, no: n, title: t }); settings.standards.sort(function (a, b) { return a.org < b.org ? -1 : a.org > b.org ? 1 : natCmp(a, b); }); saveSettings(); render(); toast('Added');
    }
    else if (act === 'stddel') { settings.standards.splice(+el.dataset.i, 1); saveSettings(); render(); }
    else if (act === 'mfrins') mfrModal(p);
    else if (act === 'mfrgo') {
      var rows = mfrRows(p), pick = [].map.call(document.querySelectorAll('[data-mfr]:checked'), function (c) { return rows[+c.dataset.mfr]; });
      if (!pick.length) return toast('Tick at least one.');
      var L = s.body.replace(/\r/g, '').split('\n'), i, starts = []; for (i = 0; i < L.length; i++) if (/^# /.test(L[i])) starts.push(i);
      var at = starts.length > 1 ? starts[1] + 1 : L.length, art = ['## MANUFACTURERS', '1: Manufacturers:'].concat(pick.map(function (r) { return '2: ' + r.mfr + (r.product ? ' ' + r.product : '') + (r.cat ? ' (' + r.cat + ')' : '') + '.'; }));
      L.splice.apply(L, [at, 0].concat(art)); s.body = L.join('\n'); saveProjects(); closeModal(); render(); toast('Inserted ' + pick.length);
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'stdq') { ui.stdQ = t.value; var pos = t.selectionStart; render(); var q = $('#stdq'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (t.dataset.stdf === undefined) return; var r = stds()[+t.dataset.i]; if (!r) return; r[t.dataset.stdf] = t.value.trim(); saveSettings();
  });

  /* ================= v2.2: Word round-trip (import edits from a .docx exported by Slate Specs) ================= */
  var WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  function normTxt(t) { return String(t || '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function docxChunks(buf) {
    var files = window.fflate.unzipSync(new Uint8Array(buf));
    if (!files['word/document.xml']) throw new Error('This does not look like a Word file.');
    var xml = new DOMParser().parseFromString(window.fflate.strFromU8(files['word/document.xml']), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error('Could not read the Word file.');
    var body = xml.getElementsByTagNameNS(WNS, 'body')[0], chunks = [], cur = [];
    [].forEach.call(xml.getElementsByTagNameNS(WNS, 'p'), function (pe) {
      for (var a = pe.parentNode; a; a = a.parentNode) if (a.localName === 'tbl') return;       /* cover and contents tables */
      var txt = '', lvl = -1, pPr = pe.getElementsByTagNameNS(WNS, 'pPr')[0];
      if (pPr) { var il = pPr.getElementsByTagNameNS(WNS, 'ilvl')[0]; if (il && il.parentNode.localName === 'numPr') lvl = +il.getAttributeNS(WNS, 'val'); }
      [].forEach.call(pe.getElementsByTagNameNS(WNS, '*'), function (n) { if (n.localName === 't') txt += n.textContent; else if (n.localName === 'tab') txt += ' '; });
      txt = normTxt(txt);
      var m = /^END OF SECTION (\d\d \d{3,4})\s*$/.exec(txt);
      if (m) { chunks.push({ code: m[1], paras: cur }); cur = []; return; }
      cur.push({ lvl: lvl, text: txt });
    });
    return chunks.map(function (c) { var i = 0; while (i < c.paras.length && c.paras[i].lvl < 0) i++; return { code: c.code, paras: c.paras.slice(i).filter(function (q) { return q.lvl >= 0 && q.text; }), skipped: c.paras.slice(i).filter(function (q) { return q.lvl < 0 && q.text; }).length }; });
  }
  function expectedList(p, s) {
    var r = renderSec(p, s, false), E = [];
    r.parts.forEach(function (pt) {
      E.push({ lvl: 0, text: normTxt(pt.title), src: pt.src, last: pt.src });
      pt.articles.forEach(function (ar) {
        E.push({ lvl: 1, text: normTxt(ar.title), src: ar.src, last: ar.src });
        ar.paras.forEach(function (pa) { if (pa.note) return; var cont = pa.cont || []; E.push({ lvl: pa.l + 1, text: normTxt(pa.segs.map(function (g) { return g.t; }).join('')), src: pa.src, last: cont.length ? cont[cont.length - 1] : pa.src, cont: cont }); });
      });
    });
    return E.filter(function (q) { return q.src != null; });
  }
  function wordReview(p, chunks) {
    var hunks = [], touched = {}, unknown = [], n = 0;
    chunks.forEach(function (c) {
      var s = p.sections.filter(function (x) { return x.code === c.code && x.on; })[0]; if (!s) { unknown.push(c.code); return; }
      var E = expectedList(p, s), ops = SS.diffSeq(E.map(function (q) { return q.text; }), c.paras.map(function (q) { return q.text; })), i = 0, j = 0, last = null, dels = [], ins = [];
      function flush() {
        var k = Math.min(dels.length, ins.length);
        for (var q = 0; q < k; q++) hunks.push({ id: ++n, code: c.code, kind: 'rev', old: dels[q], nu: ins[q] });
        for (q = k; q < dels.length; q++) hunks.push({ id: ++n, code: c.code, kind: 'del', old: dels[q] });
        for (q = k; q < ins.length; q++) hunks.push({ id: ++n, code: c.code, kind: 'add', nu: ins[q], after: ins[q].after });
        dels = []; ins = [];
      }
      ops.forEach(function (o) {
        if (o.t === '=') { flush(); last = E[i]; i++; j++; }
        else if (o.t === '-') { dels.push(E[i]); last = E[i]; i++; }
        else { var nw = c.paras[j]; nw.after = last; ins.push(nw); j++; }
      });
      flush(); touched[c.code] = 1;
    });
    return { hunks: hunks, unknown: unknown };
  }
  function condOf(line) { var m = /\?\(([^)]*)\)/.exec(line || ''); return m ? m[1] : ''; }
  function mkLine(lvl, text, cond) { var c = cond ? '?(' + cond + ') ' : ''; return lvl === 0 ? '# ' + text : lvl === 1 ? '## ' + text + (cond ? ' ?(' + cond + ')' : '') : Math.min(4, lvl - 1) + ': ' + c + text; }
  function applyWord(p, hunks) {
    var by = {}; hunks.forEach(function (h) { (by[h.code] = by[h.code] || []).push(h); });
    var cnt = 0;
    Object.keys(by).forEach(function (code) {
      var s = p.sections.filter(function (x) { return x.code === code; })[0], lines = s.body.replace(/\r/g, '').split('\n'), rep = {}, rm = {}, after = {}, head = [];
      by[code].forEach(function (h) {
        cnt++;
        if (h.kind === 'rev') { var o = h.old, cd = condOf(lines[o.src]); rep[o.src] = mkLine(h.nu.lvl, h.nu.text, cd); (o.cont || []).forEach(function (k) { rm[k] = 1; }); }
        else if (h.kind === 'del') { rm[h.old.src] = 1; (h.old.cont || []).forEach(function (k) { rm[k] = 1; }); }
        else { var ln = mkLine(h.nu.lvl, h.nu.text, ''); if (h.after) (after[h.after.last] = after[h.after.last] || []).push(ln); else head.push(ln); }
      });
      var out = head.slice();
      lines.forEach(function (l, i) { if (!rm[i]) out.push(rep[i] !== undefined ? rep[i] : l); (after[i] || []).forEach(function (a) { out.push(a); }); });
      s.body = out.join('\n');
    });
    return cnt;
  }
  function wordPanel(p) {
    return '<div class="panel"><div class="row"><div><h2 style="margin:0">Import edits from Word</h2><div class="small muted" style="margin-top:4px">Edited an exported .docx (or sent it to a consultant)? Upload it here. Every changed, added or removed paragraph is listed so you accept or reject each one. Accepted changes go into the section text.</div></div><div class="sp"></div><label class="btn">Choose edited .docx<input type="file" accept=".docx" data-wordimp style="display:none"></label></div></div>';
  }
  function wordModal(p) {
    var w = ui.wr, by = {}, order = []; w.hunks.forEach(function (h) { if (!by[h.code]) { by[h.code] = []; order.push(h.code); } by[h.code].push(h); });
    var title = function (c) { var s = p.sections.filter(function (x) { return x.code === c; })[0]; return s ? s.title : ''; };
    var body = '<h2>Review Word changes</h2><div class="small muted" style="margin-bottom:8px">' + w.hunks.length + ' change' + (w.hunks.length === 1 ? '' : 's') + ' in ' + order.length + ' section' + (order.length === 1 ? '' : 's') + '. Compared with the sections as they read now in Slate Specs. Tracked changes in the file are taken as accepted. A line that used a project answer becomes plain text once you accept its change.' + (w.unknown.length ? ' Not in this project, skipped: ' + w.unknown.join(', ') + '.' : '') + '</div>' +
      (w.hunks.length ? '<div class="row" style="margin-bottom:6px"><button class="btn sm" data-act="wrall">Accept all</button><button class="btn sm" data-act="wrnone">Reject all</button></div>' : '') +
      '<style>.wr del{background:#fbd5d5;text-decoration:line-through}.wr ins{background:#cdeccd;text-decoration:none}</style><div class="wr" style="max-height:56vh;overflow:auto">' +
      (order.map(function (c) { return '<div style="margin:10px 0 4px"><b>' + esc(c) + '</b> ' + esc(title(c)) + '</div>' + by[c].map(function (h) { var t = h.kind === 'rev' ? '<del>' + esc(h.old.text) + '</del> <ins>' + esc(h.nu.text) + '</ins>' : h.kind === 'del' ? '<del>' + esc(h.old.text) + '</del>' : '<ins>' + esc(h.nu.text) + '</ins>'; return '<label class="row" style="padding:5px 0;border-bottom:1px solid var(--line2);align-items:flex-start;cursor:pointer"><input type="checkbox" data-wh="' + h.id + '" checked style="margin-top:3px"><span style="flex:1;min-width:200px"><span class="badge' + (h.kind === 'add' ? ' g' : h.kind === 'del' ? ' r' : '') + '">' + (h.kind === 'rev' ? 'revised' : h.kind === 'add' ? 'added' : 'removed') + '</span> ' + t + '</span></label>'; }).join(''); }).join('') || '<div class="empty">No differences. The Word file matches the current text.</div>') + '</div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button>' + (w.hunks.length ? '<button class="btn pri" data-act="wrapply">Apply checked changes</button>' : '') + '</div>';
    modal(body, true);
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj();
    if (act === 'wrall' || act === 'wrnone') [].forEach.call(document.querySelectorAll('[data-wh]'), function (c) { c.checked = act === 'wrall'; });
    else if (act === 'wrapply') {
      var ids = {}; [].forEach.call(document.querySelectorAll('[data-wh]:checked'), function (c) { ids[c.dataset.wh] = 1; });
      var pick = ui.wr.hunks.filter(function (h) { return ids[h.id]; }); if (!pick.length) return toast('Nothing checked.');
      var n = applyWord(p, pick); saveProjects(); closeModal(); ui.wr = null; render(); toast('Applied ' + n + ' change' + (n === 1 ? '' : 's'));
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (t.dataset.wordimp === undefined || !t.files[0]) return; var p = proj(), f = t.files[0];
    var r = new FileReader(); r.onload = function () { try { ui.wr = wordReview(p, docxChunks(r.result)); wordModal(p); } catch (er) { toast('⚠ ' + er.message); } }; r.readAsArrayBuffer(f); t.value = '';
  });

  /* ================= v2.3: Reference projects (past manuals kept as written, searchable, section-by-section reusable) ================= */
  function archById(id) { return archive.filter(function (a) { return a.id === id; })[0]; }
  function archSec(aid, code) { var a = archById(aid); return a && a.sections.filter(function (s) { return s.code === code; })[0]; }
  function plainBody(b) { return String(b || '').replace(/^#+ /gm, '').replace(/^[1-4NnS]: /gm, ''); }
  function snip(body, tok) {
    var t = plainBody(body).replace(/\s+/g, ' '), i = t.toLowerCase().indexOf(tok); if (i < 0) return t.slice(0, 140);
    return (i > 50 ? '…' : '') + t.slice(Math.max(0, i - 50), i + 110) + (i + 110 < t.length ? '…' : '');
  }
  function archSearch(q) {
    q = String(q || '').trim().toLowerCase(); if (!q) return []; var toks = q.split(/\s+/), hits = [];
    archive.forEach(function (a) { a.sections.forEach(function (s) {
      var hay = (s.code + ' ' + s.code.replace(/\s/g, '') + ' ' + s.title).toLowerCase(), body = plainBody(s.body).toLowerCase(), score = 0, ok = true;
      toks.forEach(function (t) { var h = hay.indexOf(t) >= 0, b = body.split(t).length - 1; if (!h && !b) ok = false; score += (h ? 20 : 0) + Math.min(b, 10); });
      if (ok) hits.push({ a: a, s: s, score: score, snip: snip(s.body, toks[toks.length - 1]) });
    }); });
    return hits.sort(function (x, y) { return y.score - x.score; }).slice(0, 100);
  }
  function hitRows(hits, extra) {
    return hits.map(function (h) { return '<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line2);align-items:flex-start"><div style="flex:1;min-width:220px"><div><span class="c small muted" style="display:inline-block;width:62px">' + esc(h.s.code) + '</span><b>' + esc(h.s.title) + '</b> <span class="small muted">• ' + esc(h.a.name) + '</span></div><div class="small muted" style="margin:2px 0 0 62px">' + esc(h.snip) + '</div></div><div style="white-space:nowrap"><button class="btn sm" data-act="avopen" data-aid="' + h.a.id + '" data-code="' + esc(h.s.code) + '">View</button>' + (extra ? extra(h) : '') + '</div></div>'; }).join('');
  }
  function viewArchive() {
    var a = ui.archId && archById(ui.archId);
    if (a) {
      var rows = a.sections.slice().sort(function (x, y) { return SS.sortCodes(x.code, y.code); }).map(function (s) { return '<tr><td>' + esc(s.code) + '</td><td>' + esc(s.title) + '</td><td class="small muted">' + s.body.split('\n').length + ' lines</td><td style="text-align:right;white-space:nowrap"><button class="btn sm" data-act="avopen" data-aid="' + a.id + '" data-code="' + esc(s.code) + '">View / use</button></td></tr>'; }).join('');
      var fld = function (k, l) { return '<div class="fld"><label>' + l + '</label><input type="text" data-af="' + k + '" value="' + esc(a[k] || '') + '"></div>'; };
      return '<div class="wrap"><div class="row"><button class="btn sm" data-act="archback">← All reference projects</button><div class="sp"></div><button class="btn sm" data-act="archlibnew">Add new section numbers to master library</button><button class="btn sm danger" data-act="archdel">Delete</button></div>' +
        '<h1 style="margin-top:12px">' + esc(a.name) + '</h1><div class="panel"><div class="two">' + fld('name', 'Project name') + fld('number', 'Project no. / date') + '</div><div class="small muted">' + a.sections.length + ' sections • ' + esc(a.source || '') + ' • added ' + dstr(a.at) + '</div></div>' +
        '<div class="panel"><table class="tbl"><tr><th>No.</th><th>Section</th><th></th><th></th></tr>' + rows + '</table></div></div>';
    }
    var q = ui.archQ || '', hits = q.trim() ? archSearch(q) : [];
    var cards = archive.slice().sort(function (x, y) { return y.at - x.at; }).map(function (a) { return '<div class="panel" style="cursor:pointer" data-act="archopen" data-aid="' + a.id + '"><div class="row"><b>' + esc(a.name) + '</b>' + (a.number ? '<span class="small muted">' + esc(a.number) + '</span>' : '') + '<div class="sp"></div><span class="small muted">' + a.sections.length + ' sections • ' + esc(a.source || '') + '</span></div></div>'; }).join('');
    return '<div class="wrap"><div class="row"><div><h1>Reference projects</h1><div class="muted">Past project manuals kept as written. Search every section across all of them, view one, and copy it into a project or the master library.</div></div><div class="sp"></div><button class="btn pri" data-act="refimport">+ Import a project manual</button></div>' +
      '<div class="row" style="margin:14px 0"><input type="text" id="archq" placeholder="Search all reference projects: a section number, a title, or any wording" value="' + esc(q) + '" style="flex:1;padding:8px 12px;border-radius:999px"></div>' +
      (q.trim() ? '<div class="panel">' + (hits.length ? '<div class="small muted" style="margin-bottom:4px">' + hits.length + (hits.length === 100 ? '+' : '') + ' matching sections</div>' + hitRows(hits) : '<div class="empty">Nothing matches.</div>') + '</div>' : (cards || '<div class="panel"><div class="empty">No reference projects yet. Import a past manual (PDF or Word), or open one of your Slate Specs projects and use “Add to Reference projects” on the Issue / export tab.</div></div>')) + '</div>';
  }
  function avModal(aid, code) {
    var a = archById(aid), s = archSec(aid, code); if (!s) return; ui.av = { aid: aid, code: code };
    var txt = SS.toText(SS.render({ code: s.code, title: s.title, body: s.body, questions: [], answers: {} }, null, {}));
    var cur = proj(), opts = projects.map(function (p) { return '<option value="' + p.id + '"' + (cur && cur.id === p.id ? ' selected' : '') + '>' + esc(p.name || 'Untitled') + '</option>'; }).join('');
    modal('<h2>' + esc(s.code) + ' ' + esc(s.title) + '</h2><div class="small muted" style="margin-bottom:8px">From <b>' + esc(a.name) + '</b></div><pre style="white-space:pre-wrap;font:12px/1.5 ui-monospace,Menlo,monospace;max-height:44vh;overflow:auto;background:var(--inset);border-radius:12px;padding:12px;margin:0">' + esc(txt) + '</pre>' +
      '<div class="small" style="margin:10px 0 6px"><label><input type="checkbox" id="avclean"> Blank out this project’s names, products and dates first (AI, about 10 seconds)</label></div>' +
      '<div class="row">' + (projects.length ? '<select id="avproj" style="padding:6px 10px;border-radius:8px">' + opts + '</select><button class="btn pri" data-act="avuse">Copy into project</button>' : '<span class="small muted">Create a project to copy this into.</span>') + '<button class="btn" data-act="avlib">Add to master library</button>' + (library[s.code] && library[s.code].body ? '<button class="btn" data-act="avcmp">Compare with master</button>' : '') + '<div class="sp"></div><button class="btn" data-act="closemodal">Close</button></div>');
  }
  var CLEAN_PROMPT = function (body) { return 'Convert this specification section to reusable MASTER BOILERPLATE.\n\n' + GRAMMAR + '\n\nRULES:\n- Keep the firm’s wording, order, standards numbers and article titles exactly. Do not rewrite, shorten or add content.\n- Replace anything specific to the original project (project name, address, owner, named people, room names, sheet numbers, project-specific dates, a manufacturer or product chosen only for that job) with a [bracketed placeholder] or {{projectName}} / {{owner}} / {{architect}} / {{address}} / {{cityState}}. Keep general manufacturer lists and standards.\n\nReturn ONLY JSON: {"body":"line\\nline..."}\n\nSECTION TEXT:\n' + body; };
  async function avBody(s) {
    if (!($('#avclean') && $('#avclean').checked)) return s.body;
    if (!apiKey()) throw new Error('No Anthropic API key. Open Settings, paste your key and press Save.');
    var o = parseJson(await ai(CLEAN_PROMPT(s.body), 16000)); return str(o.body).trim() ? str(o.body).replace(/\r/g, '') : s.body;
  }
  function busyBtn(el, on) { if (!el) return; if (on) { el.dataset.t = el.textContent; el.textContent = 'Working…'; el.disabled = true; } else { el.textContent = el.dataset.t || el.textContent; el.disabled = false; } }
  function putSection(p, s, body) {
    var ex = p.sections.filter(function (x) { return x.code === s.code; })[0];
    if (ex) { if (ex.body.trim() && !confirm('Section ' + s.code + ' already has text in this project. Replace it?')) return false; ex.body = body; ex.on = true; ex.status = 'draft'; }
    else { var ns = newSection(s.code, s.title); ns.title = s.title; ns.body = body; ns.questions = []; ns.libRev = 0; p.sections.push(ns); p.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); }); }
    saveProjects(); return true;
  }
  function renderedBody(r) {
    var L = []; r.parts.forEach(function (pt) { L.push('# ' + pt.title); pt.articles.forEach(function (ar) { L.push('## ' + ar.title); ar.paras.forEach(function (pa) { if (!pa.note) L.push(pa.l + ': ' + pa.segs.map(function (g) { return g.t; }).join('')); }); }); }); return L.join('\n');
  }
  function archivePanel(p) {
    var ex = archive.filter(function (a) { return a.fromId === p.id; })[0];
    return '<div class="panel"><div class="row"><div><h2 style="margin:0">Reference projects</h2><div class="small muted" style="margin-top:4px">Save this project’s finished sections (with the answers filled in) so future projects can search and reuse them.' + (ex ? ' Saved ' + dstr(ex.at) + '.' : '') + '</div></div><div class="sp"></div><button class="btn" data-act="archadd">' + (ex ? 'Update in Reference projects' : 'Add to Reference projects') + '</button></div></div>';
  }
  function refModal(p, s) {
    var q = ui.refQ != null ? ui.refQ : s.code, hits = archSearch(q);
    modal('<h2>Reference projects – ' + esc(s.code) + ' ' + esc(s.title) + '</h2><div class="row" style="margin-bottom:6px"><input type="text" id="refq" value="' + esc(q) + '" style="flex:1;padding:8px 12px;border-radius:999px" placeholder="Section number or wording"></div><div class="small" style="margin-bottom:6px"><label><input type="checkbox" id="avclean"> Blank out the original project’s names, products and dates when I use one (AI)</label></div><div id="refres" style="max-height:48vh;overflow:auto">' + refResults(hits) + '</div><div class="mfoot"><button class="btn" data-act="closemodal">Close</button></div>', true);
  }
  function refResults(hits) { return hits.length ? hitRows(hits, function (h) { return '<button class="btn sm" data-act="refcmp" data-aid="' + h.a.id + '" data-code="' + esc(h.s.code) + '">Compare</button> <button class="btn sm pri" data-act="refhere" data-aid="' + h.a.id + '" data-code="' + esc(h.s.code) + '">Use here</button>'; }) : '<div class="empty">' + (archive.length ? 'Nothing matches.' : 'No reference projects yet. Add one from the Reference projects page.') + '</div>'; }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj(), s = curSec();
    if (act === 'archopen') { ui.archId = el.dataset.aid; render(); }
    else if (act === 'archback') { ui.archId = null; render(); }
    else if (act === 'archdel') { var a = archById(ui.archId); if (a && confirm('Delete “' + a.name + '” from Reference projects? Projects you already copied sections into are not affected.')) { archive = archive.filter(function (x) { return x.id !== a.id; }); saveArchive(); ui.archId = null; render(); } }
    else if (act === 'avopen') avModal(el.dataset.aid, el.dataset.code);
    else if (act === 'avuse') {
      var tp = projects.filter(function (x) { return x.id === $('#avproj').value; })[0], sec = archSec(ui.av.aid, ui.av.code); if (!tp || !sec) return;
      busyBtn(el, true); avBody(sec).then(function (b) { busyBtn(el, false); if (putSection(tp, sec, b)) { closeModal(); render(); toast('Copied ' + sec.code + ' into ' + (tp.name || 'project')); } }, function (er) { busyBtn(el, false); toast('⚠ ' + er.message); });
    }
    else if (act === 'avlib') {
      var sc = archSec(ui.av.aid, ui.av.code); if (!sc) return; var old = library[sc.code];
      if (old && old.body && !confirm('The master library already has ' + sc.code + '. Replace it? The current master text is kept in its history.')) return;
      busyBtn(el, true); avBody(sc).then(function (b) { busyBtn(el, false); libSet(sc.code, { code: sc.code, title: sc.title || (old && old.title) || catTitle(sc.code), body: b, questions: (old && old.questions) || [], status: 'reviewed', rev: ((old && old.rev) || 0) + 1 }); saveLibrary(); closeModal(); render(); toast(sc.code + ' added to the master library'); }, function (er) { busyBtn(el, false); toast('⚠ ' + er.message); });
    }
    else if (act === 'avcmp') { var s2 = archSec(ui.av.aid, ui.av.code), a2 = archById(ui.av.aid); diffModal('Master vs reference – ' + s2.code, 'master library', library[s2.code].body, a2.name, s2.body); }
    else if (act === 'archlibnew') {
      var ar = archById(ui.archId), add = ar.sections.filter(function (x) { return !(library[x.code] && library[x.code].body); });
      if (!add.length) return toast('Every section number here is already in the master library.');
      if (!confirm('Add ' + add.length + ' section number' + (add.length > 1 ? 's' : '') + ' that the master library does not have yet? The text stays exactly as written in this project, including its names and products. You can edit each afterward.')) return;
      add.forEach(function (x) { libSet(x.code, { code: x.code, title: x.title || catTitle(x.code), body: x.body, questions: [], status: 'reviewed', rev: 1 }); }); saveLibrary(); toast(add.length + ' added to the master library');
    }
    else if (act === 'archadd') {
      var rs = renderedFor(p, 'all', false); if (!rs.length) return toast('Nothing to add. Included sections have no text yet.');
      var ex = archive.filter(function (a) { return a.fromId === p.id; })[0];
      if (ex && !confirm('Replace the saved copy of this project in Reference projects?')) return;
      var rec = ex || { id: SS.uid(), fromId: p.id, at: 0 }; rec.name = p.name || 'Untitled'; rec.number = [p.number, p.issueDate].filter(Boolean).join(' • '); rec.source = 'Slate Specs project'; rec.at = Date.now();
      rec.sections = rs.map(function (r) { return { code: r.code, title: r.title, body: renderedBody(r) }; }); if (!ex) archive.push(rec); saveArchive(); render(); toast('Saved to Reference projects');
    }
    else if (act === 'refsec') { ui.refQ = null; refModal(p, s); }
    else if (act === 'refhere') {
      var sec2 = archSec(el.dataset.aid, el.dataset.code); if (!sec2) return;
      if (s.body.trim() && !confirm('Replace the text of ' + s.code + ' with the one from ' + archById(el.dataset.aid).name + '?')) return;
      busyBtn(el, true); avBody(sec2).then(function (b) { busyBtn(el, false); s.body = b; s.status = 'draft'; saveProjects(); closeModal(); render(); toast('Text replaced'); }, function (er) { busyBtn(el, false); toast('⚠ ' + er.message); });
    }
    else if (act === 'refcmp') { var sc3 = archSec(el.dataset.aid, el.dataset.code); diffModal('This project vs reference – ' + sc3.code, 'this project (' + s.code + ')', s.body, archById(el.dataset.aid).name, sc3.body); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'archq') { ui.archQ = t.value; var pos = t.selectionStart; render(); var q = $('#archq'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
    else if (t.id === 'refq') { ui.refQ = t.value; $('#refres').innerHTML = refResults(archSearch(t.value)); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (t.dataset.af === undefined) return; var a = archById(ui.archId); if (a) { a[t.dataset.af] = t.value.trim(); saveArchive(); if (t.dataset.af === 'name') render(); }
  });
