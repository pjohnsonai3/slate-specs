
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
  function expProject(p) { var f = settings.firm || {}, o = { secDates: secDates(p) }; if (f.numLabel) o.numLabel = f.numLabel; var an = p.architect || settings.architect || 'ai3, Inc.'; if (f.address && (!f.name || an === f.name)) o.archLine = an + ', ' + f.address; return Object.assign({}, p, o); }

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
    return h.replace('<div class="wrap">', '<div class="wrap">' + checkHtml(p) + issuesHtml(p) + modPanel(p) + mergePanel(p) + wordPanel(p) + archivePanel(p));
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
        '<h1 style="margin-top:12px">' + esc(a.name) + '</h1><div class="panel"><div class="two">' + fld('name', 'Project name') + fld('number', 'Project no. / date') + '</div><div class="fld"><label>Project type</label><select data-af="ptype"><option value="">(not set)</option>' + SS.PTYPES.map(function (t) { return '<option value="' + t + '"' + (a.ptype === t ? ' selected' : '') + '>' + esc(SS.PTYPE_LABELS[t]) + '</option>'; }).join('') + '</select></div><div class="small muted">' + a.sections.length + ' sections • ' + esc(a.source || '') + ' • added ' + dstr(a.at) + '</div></div>' +
        '<div class="panel"><table class="tbl"><tr><th>No.</th><th>Section</th><th></th><th></th></tr>' + rows + '</table></div></div>';
    }
    var q = ui.archQ || '', hits = q.trim() ? archSearch(q) : [];
    var cards = archive.slice().sort(function (x, y) { return y.at - x.at; }).map(function (a) { return '<div class="panel" style="cursor:pointer" data-act="archopen" data-aid="' + a.id + '"><div class="row"><b>' + esc(a.name) + '</b>' + (a.ptype ? '<span class="badge b">' + esc(a.ptype) + '</span>' : '') + (a.number ? '<span class="small muted">' + esc(a.number) + '</span>' : '') + '<div class="sp"></div><span class="small muted">' + a.sections.length + ' sections • ' + esc(a.source || '') + '</span></div></div>'; }).join('');
    return '<div class="wrap"><div class="row"><div><h1>Reference projects</h1><div class="muted">Past project manuals kept as written. Search every section across all of them, view one, and copy it into a project or the master library.</div></div><div class="sp"></div><button class="btn" data-act="bulkimport">Bulk import</button><button class="btn pri" data-act="refimport">+ Import a project manual</button></div>' +
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
      var rec = ex || { id: SS.uid(), fromId: p.id, at: 0 }; rec.name = p.name || 'Untitled'; rec.number = [p.number, p.issueDate].filter(Boolean).join(' • '); rec.source = 'Slate Specs project'; rec.ptype = p.ptype || rec.ptype || ''; rec.at = Date.now();
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

/* ================= PROJECT TYPES ================= */
(function () {
  function typeCounts() {
    var o = {}; SS.PTYPES.forEach(function (t) { o[t] = { n: 0, c: {} }; });
    archive.forEach(function (a) {
      if (!o[a.ptype]) return; o[a.ptype].n++; var seen = {};
      (a.sections || []).forEach(function (s) { if (seen[s.code]) return; seen[s.code] = 1; o[a.ptype].c[s.code] = (o[a.ptype].c[s.code] || 0) + 1; });
    });
    return o;
  }
  function inSet(t, code) { return (typeSets()[t] || []).indexOf(code) >= 0; }
  function typeCodes(counts) {
    var seen = {}, ts = typeSets();
    SS.PTYPES.forEach(function (t) { (ts[t] || []).forEach(function (c) { seen[c] = 1; }); Object.keys(counts[t].c).forEach(function (c) { seen[c] = 1; }); });
    (ui.typeExtra || []).forEach(function (c) { seen[c] = 1; });
    return Object.keys(seen).sort(SS.sortCodes);
  }
  window.typeBar = function (p) {
    if (!p || !p.ptype) return '<div class="small muted" style="margin-top:12px">Pick a project type to compare this project against that type’s section set.</div>';
    var set = typeSets()[p.ptype] || [], missing = set.filter(function (c) { return !p.sections.some(function (s) { return s.code === c; }); });
    var lbl = SS.PTYPE_LABELS[p.ptype];
    return missing.length
      ? '<div class="row" style="margin-top:12px"><span class="small">' + missing.length + ' section' + (missing.length > 1 ? 's' : '') + ' in the ' + esc(lbl) + ' set ' + (missing.length > 1 ? 'are' : 'is') + ' not in this project: ' + esc(missing.slice(0, 6).join(', ')) + (missing.length > 6 ? '…' : '') + '.</span><div class="sp"></div><button class="btn sm" data-act="typeadd">Add them</button></div>'
      : '<div class="small muted" style="margin-top:12px">This project has every section in the ' + esc(lbl) + ' set. Sets are edited in Settings.</div>';
  };
  function typePanel() {
    var counts = typeCounts(), codes = typeCodes(counts), ts = typeSets();
    var rows = codes.map(function (c) {
      var flags = SS.PTYPES.map(function (t) { return inSet(t, c); }), diff = flags.some(function (x) { return x !== flags[0]; });
      if (ui.typeDiff && !diff) return '';
      return '<tr' + (diff ? ' style="background:var(--surface2,rgba(127,127,127,.07))"' : '') + '><td class="small" style="white-space:nowrap">' + esc(c) + '</td><td class="small">' + esc(catTitle(c) || (library[c] && library[c].title) || '') + '</td>' +
        SS.PTYPES.map(function (t) { var k = counts[t].c[c] || 0; return '<td style="text-align:center;white-space:nowrap"><input type="checkbox" data-tset="' + t + '" data-code="' + esc(c) + '"' + (inSet(t, c) ? ' checked' : '') + '>' + (counts[t].n ? ' <span class="small muted">' + k + '/' + counts[t].n + '</span>' : '') + '</td>'; }).join('') + '</tr>';
    }).join('');
    var head = SS.PTYPES.map(function (t) { return '<th style="text-align:center">' + esc(t) + '<div class="small muted" style="font-weight:400">' + (ts[t] || []).length + ' sections • ' + counts[t].n + ' ref. project' + (counts[t].n === 1 ? '' : 's') + '</div><button class="btn sm" data-act="typelearn" data-t="' + t + '"' + (counts[t].n ? '' : ' disabled') + '>Learn from projects</button> <button class="btn sm" data-act="typereset" data-t="' + t + '">Reset</button></th>'; }).join('');
    return '<div class="panel"><h2>Project types</h2><div class="small muted" style="margin-bottom:8px">Each type has its own default set of sections, used when a new project picks that type. Tick or untick a section to change a type’s set. Shaded rows are sections where the types differ. Tag your Reference projects by type, and the k/n figures show how many of them contain each section. “Learn from projects” sets a type to the sections found in at least half of its reference projects. The sets start from ai3’s existing starter lists, so treat them as a starting point. A project’s type is also available to section text as <code>?(projectType=Hotel)</code> and <code>{{projectType}}</code>.</div>' +
      '<div class="row" style="margin-bottom:8px"><label class="small"><input type="checkbox" data-typediff' + (ui.typeDiff ? ' checked' : '') + '> Only show sections that differ</label><div class="sp"></div><input type="text" id="typenew" placeholder="Add a row: 09 300" style="width:130px;padding:6px"><button class="btn sm" data-act="typenewrow">Add row</button></div>' +
      '<div style="max-height:420px;overflow:auto"><table class="tbl"><tr><th>No.</th><th>Section</th>' + head + '</tr>' + (rows || '<tr><td colspan="6" class="muted">Nothing to show.</td></tr>') + '</table></div></div>';
  }
  var viewSettings1 = viewSettings;
  viewSettings = function () { var h = viewSettings1(), i = h.lastIndexOf('</div>'); return h.slice(0, i) + typePanel() + h.slice(i); };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj();
    if (act === 'typeadd') {
      if (!p || !p.ptype) return; var set = typeSets()[p.ptype] || [], before = p.sections.length;
      addSections(p, set); saveProjects(); render(); toast((p.sections.length - before) + ' sections added');
    }
    else if (act === 'typelearn') {
      var t = el.dataset.t, c = typeCounts()[t]; if (!c.n) return;
      var learned = Object.keys(c.c).filter(function (k) { return c.c[k] / c.n >= 0.5; }).sort(SS.sortCodes);
      if (!learned.length) return toast('No section appears in half of the ' + t + ' projects.');
      if (!confirm('Set the ' + t + ' list to the ' + learned.length + ' sections found in at least half of your ' + c.n + ' ' + t + ' reference project' + (c.n > 1 ? 's' : '') + '?' + (c.n < 3 ? ' With fewer than 3 projects this will mostly mirror them.' : '') + ' This replaces the current ' + (typeSets()[t] || []).length + '-section list.')) return;
      typeSets()[t] = learned; saveSettings(); render(); toast(t + ' set updated');
    }
    else if (act === 'typereset') {
      var t2 = el.dataset.t; if (!confirm('Reset the ' + t2 + ' list to the starting set?')) return;
      typeSets()[t2] = (SS.TYPE_SEED[t2] || []).slice(); saveSettings(); render();
    }
    else if (act === 'typenewrow') {
      var v = (($('#typenew') || {}).value || '').trim().replace(/\s+/g, ' '); var m = v.match(/^(\d{2})\s?(\d{3,4})$/); if (!m) return toast('Enter a section number like 09 300.');
      var code = m[1] + ' ' + m[2]; ui.typeExtra = (ui.typeExtra || []).concat(code); render();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.tset !== undefined) {
      var set = typeSets()[t.dataset.tset] || (typeSets()[t.dataset.tset] = []), i = set.indexOf(t.dataset.code);
      if (t.checked && i < 0) { set.push(t.dataset.code); set.sort(SS.sortCodes); } else if (!t.checked && i >= 0) set.splice(i, 1);
      saveSettings(); render();
    }
    else if (t.dataset.typediff !== undefined) { ui.typeDiff = t.checked; render(); }
    else if (t.dataset.pf === 'ptype') {
      var np = $('#npstart'); if (np && t.value) np.value = 't:' + t.value;
      var bar = $('#typebar'), p = proj(); if (bar && p && ui.tab === 'info') { p.ptype = t.value; saveSoon(); bar.innerHTML = typeBar(p); }
    }
  });
})();


/* ================= MODIFICATIONS: apply a change document to a project ================= */
(function () {
  var mod = { list: [], skipped: [], name: '', file: '' };
  function modPanel(p) {
    var log = (p.mods || []).map(function (m) {
      var rep = m.items.filter(function (i) { return i.action === 'replaced'; }).length, add = m.items.length - rep;
      return '<tr><td>' + esc(m.name) + '</td><td class="small muted">' + dstr(m.at) + '</td><td class="small">' + rep + ' replaced, ' + add + ' added: ' + esc(m.items.map(function (i) { return i.code; }).join(', ')) + '</td><td style="text-align:right"><button class="btn sm danger" data-act="modundo" data-id="' + m.id + '">Undo</button></td></tr>';
    }).join('');
    return '<div class="panel"><div class="row"><div><h2 style="margin:0">Modifications</h2><div class="small muted" style="margin-top:4px">Apply an addendum, bulletin, owner change or other marked document. Sections in it replace the same section numbers in this project, and new section numbers are added. You choose which ones apply, and every modification can be undone.</div></div><div class="sp"></div><button class="btn" data-act="modopen">Apply a modification document</button></div>' +
      (log ? '<table class="tbl" style="margin-top:10px"><tr><th>Modification</th><th>Applied</th><th>Sections</th><th></th></tr>' + log + '</table>' : '') + '</div>';
  }
  window.modPanel = modPanel;
  function modModal() {
    modal('<h2>Apply a modification document</h2><div class="small muted" style="margin-bottom:8px">Upload the document (PDF or Word) that contains the changed sections as full text. The AI splits it into sections. Nothing changes in the project until you press Apply.</div>' +
      '<div class="fld"><label>Modification name</label><input type="text" id="modname" value="' + esc(mod.name) + '" placeholder="Addendum No. 2"></div>' +
      '<label class="dz" data-dz="mod"><span class="dzt">✨ Drop the modification document (PDF or Word) here</span><span class="dzs">or click to browse</span><input type="file" id="modfile" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-modfile style="display:none"></label>' +
      '<div class="small" id="prog-manual" style="margin-top:8px;min-height:18px"></div><div class="small" id="err-manual" style="color:#a33;display:none"></div><div id="modlist"></div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" id="modapply" data-act="modapply" style="display:none">Apply</button></div>', true);
    modRender();
  }
  function modDiff(p, x) {
    var r = renderedFor(p, 'all', false).filter(function (q) { return q.code === x.code; })[0], s0 = p.sections.filter(function (q) { return q.code === x.code; })[0];
    var ops = SS.diffLines(r ? renderedBody(r) : (s0 ? s0.body : ''), x.body), ds = SS.diffStats(ops);
    return '<div style="padding:6px 10px"><div class="small muted" style="margin-bottom:4px"><span class="badge r">− current</span> <span class="badge g">+ modification</span> • ' + ds.add + ' lines added, ' + ds.del + ' removed</div><style>' + SS.REDLINE_CSS + '</style><div style="max-height:30vh;overflow:auto;border-radius:12px;background:var(--inset);padding:6px 0">' + (ds.changed ? SS.redlineHtml(ops, 3) : '<div class="empty">No differences.</div>') + '</div></div>';
  }
  function modRender() {
    var el = $('#modlist'); if (!el) return; var p = proj();
    el.innerHTML = mod.list.length ? '<div style="max-height:44vh;overflow:auto;border:1px solid var(--border);border-radius:8px;margin-top:8px">' + mod.list.map(function (x, i) {
      var ex = p.sections.filter(function (s) { return s.code === x.code; })[0];
      return '<div class="sec" style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-modi="' + i + '" checked><span class="c">' + esc(x.code) + '</span><span class="t" style="flex:1">' + esc(x.title) + '</span><span class="small muted">' + x.body.split('\n').length + ' lines</span>' +
        (ex ? '<span class="badge n">replaces existing</span><button class="btn sm" data-act="modcmp" data-i="' + i + '">' + (mod.open === i ? 'Hide' : 'Compare') + '</button>' : '<span class="badge g">new section</span>') + '</div>' + (mod.open === i ? modDiff(p, x) : '');
    }).join('') + '</div>' + (mod.skipped.length ? '<div class="small" style="color:#a33;margin-top:6px">Pages the AI could not read: ' + mod.skipped.join(', ') + '</div>' : '') : '';
    var b = $('#modapply'); if (b) b.style.display = mod.list.length ? '' : 'none';
  }
  window.modAdd = function (f) {
    var n = $('#modname'); if (n && !n.value) n.value = f.name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim();
    mod.list = []; mod.skipped = []; modRender(); setErr('manual', '');
    withBusy('modread', null, async function () {
      try {
        var got = await extractManual(f, refPrompt); mod.list = got.list; mod.skipped = got.skipped;
        setProg('manual', mod.list.length ? 'Done: ' + mod.list.length + ' sections found. Review below.' : 'No specification sections were found in that file.'); modRender();
      } catch (err) { setProg('manual', ''); aiNote = null; setErr('manual', String(err && err.message || err)); throw err; }
    })();
  };
  document.addEventListener('change', function (e) { var t = e.target; if (t.dataset && t.dataset.modfile !== undefined && t.files.length) { var f = t.files[0]; t.value = ''; modAdd(f); } });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj();
    if (act === 'modopen') { mod = { list: [], skipped: [], name: '', file: '', open: -1 }; modModal(); }
    else if (act === 'modcmp') { var k = +el.dataset.i; mod.open = mod.open === k ? -1 : k; modRender(); }
    else if (act === 'modapply') {
      var picked = [].map.call(document.querySelectorAll('[data-modi]:checked'), function (c) { return mod.list[+c.dataset.modi]; }); if (!picked.length) return toast('Select at least one section.');
      var nm = (($('#modname') || {}).value || '').trim() || 'Modification';
      var nrep = picked.filter(function (x) { return p.sections.some(function (s) { return s.code === x.code; }); }).length;
      if (!confirm('Apply “' + nm + '”? ' + nrep + ' existing section' + (nrep === 1 ? '' : 's') + ' will be replaced and ' + (picked.length - nrep) + ' added. You can undo it afterward.')) return;
      var items = [];
      picked.forEach(function (x) {
        var s = p.sections.filter(function (q) { return q.code === x.code; })[0];
        if (s) {
          items.push({ code: x.code, action: 'replaced', prev: { title: s.title, body: s.body, questions: s.questions, answers: s.answers, aiKeys: s.aiKeys, status: s.status, on: s.on } });
          s.body = x.body; s.title = x.title || s.title; s.questions = []; s.answers = {}; s.aiKeys = []; s.status = 'draft'; s.on = true;
        } else {
          var n = newSection(x.code, x.title); n.body = x.body; n.questions = []; n.answers = {}; n.libRev = 0; p.sections.push(n); items.push({ code: x.code, action: 'added' });
        }
      });
      p.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); });
      (p.mods = p.mods || []).unshift({ id: SS.uid(), name: nm, at: Date.now(), items: items });
      saveProjects(); closeModal(); render(); toast(nrep + ' replaced, ' + (picked.length - nrep) + ' added');
    }
    else if (act === 'modundo') {
      var m = (p.mods || []).filter(function (q) { return q.id === el.dataset.id; })[0]; if (!m) return;
      if (!confirm('Undo “' + m.name + '”? Sections it replaced go back to their earlier text, and sections it added are removed. Any edits made to those sections since will be lost.')) return;
      m.items.forEach(function (it) {
        var i = p.sections.findIndex(function (s) { return s.code === it.code; }); if (i < 0) return;
        if (it.action === 'added') p.sections.splice(i, 1); else { var s = p.sections[i], pv = it.prev; s.title = pv.title; s.body = pv.body; s.questions = pv.questions; s.answers = pv.answers; s.aiKeys = pv.aiKeys; s.status = pv.status; s.on = pv.on; }
      });
      p.mods = p.mods.filter(function (q) { return q.id !== m.id; }); saveProjects(); render(); toast('Undone');
    }
  });
})();


/* ================= PRODUCTS: cut sheet -> researched facts -> written section (cut sheet only, no web) ================= */
(function () {
  var prod = { pid: null, files: [], label: '', notes: '', facts: null, code: '', title: '', draft: null, warn: [] };
  function reset(p) { prod = { pid: p && p.id, files: [], label: '', notes: '', facts: null, code: '', title: '', draft: null, warn: [] }; }
  var FACT_PROMPT = function () {
    var cat = SS.CATALOG.map(function (c) { return c[0] + ' ' + c[1]; }).join('; ');
    return 'You are reading manufacturer product literature (cut sheets, data sheets, installation guides, warranties) for an architect who will write a specification section for this product.\n\nExtract ONLY what the documents actually state. Do not infer, estimate, or add anything from general knowledge. If something is not stated, leave it out. Record the page number where each property or standard appears when you can tell.\n\nSuggest the best CSI MasterFormat section for the product. Prefer one from this list when it fits: ' + cat + '. Otherwise give the correct MasterFormat number and title.\n\nReturn ONLY a JSON object:\n{"manufacturer":"","productName":"","modelNumbers":[],"category":"","suggestedSection":{"code":"09 650","title":""},"summary":"one or two sentences taken from the document","properties":[{"name":"","value":"","standard":"","page":""}],"standards":[{"org":"ASTM","number":"E84","title":"","page":""}],"dimensions":[""],"materials":[""],"finishes":[""],"installation":[""],"warranty":"","certifications":[""],"accessories":[""],"unclear":["things a specifier would need that the documents do not state or state ambiguously"]}';
  };
  var SECTION_PROMPT = function (code, title, facts, notes, existing) {
    return 'You are a senior architectural specifier writing a SPECIFICATION SECTION for ai3, Inc., an Atlanta architecture, interior design and FF&E firm. Write SECTION ' + code + ' – ' + title + ' for the product below, in CSI SectionFormat (three parts), architect scope, concise and complete.\n\n' + GRAMMAR + '\n\nSOURCE FACTS (extracted from the manufacturer\'s literature; this is the ONLY source of product data):\n' + JSON.stringify(facts) + '\n\n' + (notes ? 'DESIGNER NOTES (where and how the product is used):\n' + notes + '\n\n' : '') +
      (existing ? 'EXISTING AI3 TEXT FOR THIS SECTION. Follow its article structure, numbering, wording and the submittal, quality assurance, delivery, warranty and execution language. Replace only the product-specific content:\n' + existing.slice(0, 14000) + '\n\n' : 'There is no existing ai3 text for this section. Use standard CSI article names (SUMMARY, REFERENCES, ACTION SUBMITTALS, QUALITY ASSURANCE, DELIVERY, STORAGE, AND HANDLING, WARRANTY, MANUFACTURERS, MATERIALS, EXAMINATION, INSTALLATION, FIELD QUALITY CONTROL, PROTECTION).\n\n') +
      'RULES:\n- Basis of design: name the manufacturer and product or model from the facts. Add "Other acceptable manufacturers: [list manufacturers]" as a placeholder. Name no other manufacturer.\n- Every number, rating, dimension, standard and warranty term must come from SOURCE FACTS. Do not add values from your own knowledge. Where the section needs a value the facts do not give, write a [bracketed blank], for example [color to be selected by Architect].\n- Write requirements as requirements ("shall comply with"), not as marketing description.\n- Cite only standards that appear in the facts.\n- Use literal text. Do not use {{variables}} or ?( ) conditions.\n- Add one N: note to the specifier for each item in "unclear", and one N: note near the top saying the section was written from the manufacturer literature and must be reviewed.\n\nReturn ONLY JSON: {"title":"section title","body":"line\\nline..."}';
  };
  function docParts(files) {
    return Promise.all(files.map(async function (f) {
      var ext = (f.name.split('.').pop() || '').toLowerCase(), u8 = await readBuf(f);
      if (ext === 'docx') return { type: 'text', text: 'DOCUMENT ' + f.name + ':\n' + docxText(u8).slice(0, 60000) };
      if (u8.length > MAX_BYTES) throw new Error(f.name + ' is too large (' + Math.round(u8.length / 1048576) + ' MB). Cut sheets should be small; use only the product pages.');
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64(u8) } };
    }));
  }
  function numsNotIn(body, facts) {
    var hay = JSON.stringify(facts).replace(/,(?=\d)/g, ''), seen = {}, out = [];
    body.split('\n').filter(function (l) { return !/^N:/.test(l); }).forEach(function (l) {
      (l.replace(/,(?=\d{3})/g, '').match(/\d+(?:\.\d+)?/g) || []).forEach(function (n) { if (n.length < 2 && n.indexOf('.') < 0) return; if (hay.indexOf(n) < 0 && !seen[n]) { seen[n] = 1; out.push(n); } });
    });
    return out;
  }
  window.prodAdd = function (files) {
    files.forEach(function (f) { var e = (f.name.split('.').pop() || '').toLowerCase(); if ((e === 'pdf' || e === 'docx') && !prod.files.some(function (x) { return x.name === f.name && x.size === f.size; })) prod.files.push(f); });
    if (ui.tab === 'products') render();
  };
  window.viewProducts = function (p) {
    if (prod.pid !== p.id) reset(p);
    var fl = prod.files.map(function (f, i) { return '<div class="row" style="padding:2px 0"><span class="small">' + esc(f.name) + '</span><span class="small muted">' + Math.max(1, Math.round(f.size / 1024)) + ' KB</span><button class="btn sm danger" data-act="prodrm" data-i="' + i + '">✕</button></div>'; }).join('');
    var h = '<div class="wrap"><div class="panel"><h2>Product to spec</h2><div class="small muted" style="margin-bottom:10px">Drop the manufacturer’s cut sheet (add the installation guide and warranty too if you have them). The AI pulls out only what those documents state, you review the facts, and it writes a specification section from them. Nothing is researched on the web, and anything the documents do not say is left as a [bracketed blank] for you.</div>' +
      '<label class="dz" data-dz="prod"><span class="dzt">✨ Drop cut sheets (PDF or Word) here</span><span class="dzs">or click to browse. Select every document for ONE product.</span><input type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-prodfile style="display:none"></label>' + (fl ? '<div style="margin:8px 0">' + fl + '</div>' : '') +
      '<div class="fld" style="margin-top:8px"><label>Where and how it is used (optional)</label><textarea data-prodf="notes" rows="2" placeholder="Guestroom corridors, basis of design, Owner-selected color…">' + esc(prod.notes) + '</textarea></div>' +
      '<div class="row"><button class="btn pri" data-act="prodread"' + (prod.files.length ? '' : ' disabled') + '>Read the cut sheet</button><span class="small" id="prog-manual"></span></div><div class="small" id="err-manual" style="color:#a33;display:none"></div></div>';
    if (prod.facts) h += factsPanel(p);
    if (prod.draft) h += draftPanel(p);
    var log = (p.products || []).map(function (x) { return '<tr><td>' + esc(x.manufacturer) + ' ' + esc(x.productName) + '</td><td class="small">' + esc(x.code) + '</td><td class="small muted">' + dstr(x.at) + '</td><td style="text-align:right"><button class="btn sm" data-act="prodopen" data-code="' + esc(x.code) + '">Open section</button></td></tr>'; }).join('');
    if (log) h += '<div class="panel"><h2>Products specified in this project</h2><table class="tbl"><tr><th>Product</th><th>Section</th><th>Added</th><th></th></tr>' + log + '</table></div>';
    return h + '</div>';
  };
  function factsPanel(p) {
    var f = prod.facts, L = function (a) { return (a || []).filter(Boolean); };
    var props = L(f.properties).map(function (x) { return '<tr><td class="small">' + esc(x.name) + '</td><td class="small">' + esc(x.value) + '</td><td class="small muted">' + esc(x.standard || '') + '</td><td class="small muted">' + (x.page ? 'p. ' + esc(x.page) : '') + '</td></tr>'; }).join('');
    var rows = [['Manufacturer', f.manufacturer], ['Product', f.productName], ['Models', L(f.modelNumbers).join(', ')], ['Summary', f.summary], ['Dimensions', L(f.dimensions).join('; ')], ['Materials', L(f.materials).join('; ')], ['Finishes', L(f.finishes).join('; ')], ['Installation', L(f.installation).join('; ')], ['Warranty', f.warranty], ['Certifications', L(f.certifications).join('; ')], ['Standards cited', L(f.standards).map(function (x) { return (x.org || '') + ' ' + (x.number || ''); }).join(', ')], ['Accessories', L(f.accessories).join('; ')]]
      .filter(function (r) { return r[1]; }).map(function (r) { return '<tr><td class="small" style="white-space:nowrap;vertical-align:top"><b>' + r[0] + '</b></td><td class="small" colspan="3">' + esc(r[1]) + '</td></tr>'; }).join('');
    var un = L(f.unclear).length ? '<div class="small" style="margin-top:8px;color:#a33"><b>Not stated or unclear in the documents</b> (these become blanks in the section):<ul style="margin:4px 0 0 18px">' + L(f.unclear).map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul></div>' : '';
    var opts = SS.CATALOG.map(function (c) { return '<option value="' + c[0] + '"></option>'; }).join('');
    return '<div class="panel"><h2>What the cut sheet says</h2><div class="small muted" style="margin-bottom:6px">Read straight from your documents. Check it before writing the section.</div><table class="tbl">' + rows + (props ? '<tr><th>Property</th><th>Value</th><th>Standard</th><th>Page</th></tr>' + props : '') + '</table>' + un +
      '<div class="two" style="margin-top:12px"><div class="fld"><label>Section number</label><input type="text" list="prodcodes" data-prodf="code" value="' + esc(prod.code) + '" placeholder="09 650"><datalist id="prodcodes">' + opts + '</datalist></div><div class="fld"><label>Section title</label><input type="text" data-prodf="title" value="' + esc(prod.title) + '"></div></div>' +
      (prod.code && p.sections.some(function (s) { return s.code === prod.code; }) ? '<div class="small muted">This project already has section ' + esc(prod.code) + '. The new text will replace it only after you approve, and it can be undone.</div>' : '') +
      '<div class="row" style="margin-top:8px"><button class="btn pri" data-act="prodwrite">Write the section</button></div></div>';
  }
  function draftPanel(p) {
    var ex = p.sections.filter(function (s) { return s.code === prod.code; })[0], body = prod.draft.body;
    var view;
    if (ex && ex.body.trim()) { var r = renderedFor(p, 'all', false).filter(function (q) { return q.code === ex.code; })[0], ops = SS.diffLines(r ? renderedBody(r) : ex.body, body), ds = SS.diffStats(ops); view = '<div class="small muted" style="margin-bottom:4px"><span class="badge r">− current</span> <span class="badge g">+ new</span> • ' + ds.add + ' lines added, ' + ds.del + ' removed</div><style>' + SS.REDLINE_CSS + '</style><div style="max-height:50vh;overflow:auto;border-radius:12px;background:var(--inset);padding:6px 0">' + SS.redlineHtml(ops, 3) + '</div>'; }
    else view = '<pre style="white-space:pre-wrap;max-height:50vh;overflow:auto;background:var(--inset);border-radius:12px;padding:10px;font-size:12.5px">' + esc(body) + '</pre>';
    var warn = prod.warn.length ? '<div class="small" style="margin:8px 0;color:#a33"><b>Check these figures.</b> They do not appear in the cut sheet facts. Some may be ordinary boilerplate: ' + esc(prod.warn.join(', ')) + '</div>' : '<div class="small muted" style="margin:8px 0">Every figure in the text appears in the cut sheet facts.</div>';
    return '<div class="panel"><h2>Section ' + esc(prod.code) + ' – ' + esc(prod.draft.title) + '</h2>' + warn + view +
      '<div class="row" style="margin-top:10px"><button class="btn pri" data-act="prodapply">' + (ex ? 'Replace section in project' : 'Add section to project') + '</button><button class="btn" data-act="proddiscard">Discard</button></div></div>';
  }
  document.addEventListener('input', function (e) { var t = e.target; if (t.dataset && t.dataset.prodf) prod[t.dataset.prodf] = t.value; });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset) return;
    if (t.dataset.prodfile !== undefined && t.files.length) { prodAdd([].slice.call(t.files)); t.value = ''; }
    else if (t.dataset.prodf === 'code') { var c = SS.CATALOG.filter(function (x) { return x[0] === t.value.trim(); })[0]; if (c && !prod.title) { prod.title = c[1]; render(); } }
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj();
    if (act === 'prodrm') { prod.files.splice(+el.dataset.i, 1); render(); }
    else if (act === 'prodread') {
      if (!prod.files.length) return; var files = prod.files.slice(); prod.facts = null; prod.draft = null; setErr('manual', '');
      withBusy('prodread', el, async function () {
        try {
          setProg('manual', 'AI is reading the cut sheet…');
          var parts = await docParts(files); aiNote = function (m) { setProg('manual', m); };
          var out = parseJson((await aiFull(parts.concat([{ type: 'text', text: FACT_PROMPT() }]), 6000)).text); aiNote = null;
          if (!out || (!out.manufacturer && !out.productName && !(out.properties || []).length)) throw new Error('No product information could be read from those documents.');
          prod.facts = out; var sg = out.suggestedSection || {}; prod.code = String(sg.code || '').replace(/^(\d{2})(\d{3,4})$/, '$1 $2'); prod.title = sg.title || ''; setProg('manual', ''); render();
        } catch (err) { setProg('manual', ''); aiNote = null; setErr('manual', String(err && err.message || err)); throw err; }
      })();
    }
    else if (act === 'prodwrite') {
      var code = (prod.code || '').trim().replace(/^(\d{2})\s?(\d{3,4})$/, '$1 $2'); if (!/^\d{2} \d{3,4}$/.test(code)) return toast('Enter a section number like 09 650.');
      prod.code = code; if (!prod.title) prod.title = (SS.CATALOG.filter(function (x) { return x[0] === code; })[0] || [0, ''])[1] || (prod.facts.suggestedSection || {}).title || '';
      var lib = library[code], cur = p.sections.filter(function (s) { return s.code === code; })[0], existing = (cur && cur.body.trim()) ? cur.body : (lib && lib.body) || '';
      withBusy('prodwrite', el, async function () {
        setProg('manual', 'AI is writing the section…');
        try {
          var out = parseJson(await ai(SECTION_PROMPT(code, prod.title, prod.facts, prod.notes, existing), 9000));
          if (typeof out.body !== 'string' || !out.body.trim()) throw new Error('The AI returned no section text.');
          prod.draft = { title: (out.title || prod.title).toString(), body: out.body.replace(/\r/g, '') }; prod.warn = numsNotIn(prod.draft.body, prod.facts); setProg('manual', ''); render();
        } catch (err) { setProg('manual', ''); setErr('manual', String(err && err.message || err)); throw err; }
      })();
    }
    else if (act === 'proddiscard') { prod.draft = null; prod.warn = []; render(); }
    else if (act === 'prodapply') {
      var d = prod.draft, f = prod.facts, s = p.sections.filter(function (q) { return q.code === prod.code; })[0];
      if (s && s.body.trim() && !confirm('Replace the text of section ' + s.code + ' in this project? You can undo it from Issue / export, under Modifications.')) return;
      var items = [];
      if (s) { items.push({ code: s.code, action: 'replaced', prev: { title: s.title, body: s.body, questions: s.questions, answers: s.answers, aiKeys: s.aiKeys, status: s.status, on: s.on } }); s.body = d.body; s.title = d.title; s.questions = []; s.answers = {}; s.aiKeys = []; s.status = 'draft'; s.on = true; }
      else { var n = newSection(prod.code, d.title); n.body = d.body; n.questions = []; n.answers = {}; n.libRev = 0; p.sections.push(n); p.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); }); items.push({ code: prod.code, action: 'added' }); }
      var nm = 'Product spec: ' + [f.manufacturer, f.productName].filter(Boolean).join(' ');
      (p.mods = p.mods || []).unshift({ id: SS.uid(), name: nm, at: Date.now(), items: items });
      (p.products = p.products || []).unshift({ id: SS.uid(), manufacturer: f.manufacturer || '', productName: f.productName || '', code: prod.code, at: Date.now(), facts: f });
      saveProjects(); var code2 = prod.code; reset(p); ui.tab = 'sections'; ui.code = code2; render(); toast('Section ' + code2 + ' written. Review it in the editor.', 5000);
    }
    else if (act === 'prodopen') { ui.tab = 'sections'; ui.code = el.dataset.code; render(); }
  });
})();


/* ================= MERGE: licensed documents (AIA forms and others) into the exported PDF ================= */
(function () {
  var mg = { map: null, base: null, docs: [], busy: false };
  window.mergePanel = function (p) {
    return '<div class="panel"><div class="row"><div><h2 style="margin:0">Merge documents into the PDF</h2><div class="small muted" style="margin-top:4px">Add the licensed AIA forms (General Conditions, Agreement, Instructions to Bidders) or any other PDF to the manual. Slate asks which documents to merge and where each one goes. The merged documents get their own bookmarks.</div></div><div class="sp"></div><button class="btn" data-act="mergeopen">Merge documents…</button></div></div>';
  };
  function pageMapFor(p) {
    return new Promise(function (resolve, reject) {
      var r = renderedFor(p, 'all', ui.notes); if (!r.length) return reject(new Error('Nothing to export yet. Included sections have no text.'));
      var html = SS.manualHtml(expProject(p), r, { cover: true });
      var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0'; document.body.appendChild(f);
      f.onload = function () {
        var tries = 0; (function go() {
          var w = f.contentWindow; if (!w.__ready && tries++ < 150) return setTimeout(go, 100);
          try {
            var pgs = [].slice.call(w.document.querySelectorAll('#out > .pg')), pts = [], tocEnd = 1, sawToc = false;
            pgs.forEach(function (pg, i) {
              var h1 = pg.querySelector('h1.bm'), h2 = pg.querySelector('h2.bm');
              if (h1 && h1.id === 's-01001') { sawToc = true; }
              if (h1 && !h1.id) pts.push({ kind: 'div', label: h1.textContent.trim(), at: i });
              if (h2) pts.push({ kind: 'sec', label: h2.textContent.trim().replace(/^SECTION /, ''), at: i });
              if (sawToc && !h2 && !(h1 && !h1.id) && pts.length === 0) tocEnd = i + 1;
            });
            var first = pts.length ? pts[0].at : pgs.length; if (first > tocEnd) tocEnd = first;
            f.remove(); resolve({ total: pgs.length, pts: pts, tocEnd: tocEnd });
          } catch (e) { f.remove(); reject(e); }
        })();
      };
      f.srcdoc = html;
    });
  }
  function posOptions(sel) {
    var m = mg.map, o = [['c', 'After the cover'], ['t', 'After the table of contents']].concat(m.pts.map(function (x, i) { return ['p' + i, 'Before ' + (x.kind === 'div' ? x.label : 'Section ' + x.label)]; }), [['e', 'At the end of the manual'], ['n', 'After page number…']]);
    return o.map(function (x) { return '<option value="' + x[0] + '"' + (sel === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
  }
  function guessPos(name) {
    var n = name.toLowerCase(), m = mg.map; if (!m) return 't';
    if (/a201|a101|a133|a701|a105|general conditions|agreement|instructions to bidders|bid form|supplementary/.test(n)) {
      var i = -1; m.pts.forEach(function (x, k) { if (i < 0 && /DIVISION 01/i.test(x.label)) i = k; }); return i >= 0 ? 'p' + i : 't';
    }
    return 'e';
  }
  function idxFor(d) {
    var m = mg.map, v = d.pos;
    if (v === 'c') return 1; if (v === 't') return m.tocEnd; if (v === 'e') return m.total;
    if (v === 'n') return Math.max(0, Math.min(m.total, parseInt(d.page, 10) || 0));
    return m.pts[+v.slice(1)].at;
  }
  function mergeModal() {
    var m = mg.map;
    var rows = mg.docs.map(function (d, i) {
      return '<tr><td class="small" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(d.file.name) + '">' + esc(d.file.name) + '</td><td><input type="text" data-mglabel="' + i + '" value="' + esc(d.label) + '" style="width:100%;padding:4px 6px"></td>' +
        '<td><select data-mgpos="' + i + '">' + posOptions(d.pos) + '</select>' + (d.pos === 'n' ? ' <input type="number" min="0" data-mgpage="' + i + '" value="' + esc(d.page || '') + '" style="width:70px;padding:4px" placeholder="page">' : '') + '</td>' +
        '<td><button class="btn sm danger" data-act="mgrm" data-i="' + i + '">✕</button></td></tr>';
    }).join('');
    modal('<h2>Merge documents into the PDF</h2><div class="small muted" style="margin-bottom:10px">Step 1: export the manual to PDF the usual way (PDF button, then Save as PDF) and choose that file here. Step 2: add the documents to merge and say where each one goes.</div>' +
      '<div class="fld"><label>1. The manual PDF saved from Slate</label><input type="file" accept=".pdf,application/pdf" data-mgbase>' + (mg.base ? '<div class="small" style="margin-top:4px">' + esc(mg.base.name) + (mg.basePages ? ' • ' + mg.basePages + ' pages' : '') + (m && mg.basePages && mg.basePages !== m.total ? ' <span style="color:#a33">• Slate expects ' + m.total + ' pages, so positions may be off. Check the positions, or use “After page number”.</span>' : '') + '</div>' : '') + '</div>' +
      '<div class="fld"><label>2. Documents to merge</label><label class="dz" data-dz="mg"><span class="dzt">✨ Drop PDFs here (AIA forms, bid forms, anything)</span><span class="dzs">or click to browse. Pick as many as you like.</span><input type="file" multiple accept=".pdf,application/pdf" data-mgdocs style="display:none"></label>' + (window.stdPickHtml ? window.stdPickHtml(proj()) : '') + '</div>' +
      (m ? '' : '<div class="small muted">Reading the manual layout…</div>') +
      (rows ? '<div style="max-height:36vh;overflow:auto;border:1px solid var(--border);border-radius:8px"><table class="tbl"><tr><th>File</th><th>Bookmark name</th><th>Goes</th><th></th></tr>' + rows + '</table></div>' : '') +
      '<div class="small" id="mgstatus" style="margin-top:8px;min-height:18px"></div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" data-act="mgrun"' + (mg.base && mg.docs.length && m ? '' : ' disabled') + '>Merge and download</button></div>', true);
  }
  window.__mk = { pageMapFor: pageMapFor, addOutline: addOutline };
  window.mgAdd = function (files) {
    files.forEach(function (f) { if (!/\.pdf$/i.test(f.name) || mg.docs.some(function (d) { return d.file.name === f.name && d.file.size === f.size; })) return; mg.docs.push({ file: f, label: f.__label || f.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '), pos: guessPos(f.name), page: '' }); });
    mergeModal();
  };
  async function mergeRun() {
    var PL = window.PDFLib; if (!PL) throw new Error('PDF library is missing.');
    var st = $('#mgstatus'), say = function (t) { if (st) st.textContent = t; };
    say('Reading the manual…'); var base = await PL.PDFDocument.load(await readBuf(mg.base), { ignoreEncryption: true, updateMetadata: false });
    var jobs = mg.docs.map(function (d, k) { return { d: d, k: k, at: idxFor(d) }; }).sort(function (a, b) { return b.at - a.at || b.k - a.k; }), added = [];
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i]; say('Merging ' + (i + 1) + ' of ' + jobs.length + ': ' + j.d.file.name + '…');
      var src = await PL.PDFDocument.load(await readBuf(j.d.file), { ignoreEncryption: true, updateMetadata: false });
      var pages = await base.copyPages(src, src.getPageIndices()); pages.forEach(function (pg, n) { base.insertPage(j.at + n, pg); });
      added.push({ k: j.k, label: j.d.label, ref: pages[0].ref });
    }
    added.sort(function (a, b) { return a.k - b.k; }); addOutline(base, added);
    say('Saving…'); var bytes = await base.save();
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = ((proj().number ? proj().number + ' ' : '') + (proj().name || 'Project') + ' - Project Manual (merged).pdf').replace(/[\\/:*?"<>|]/g, ''); document.body.appendChild(a); a.click(); a.remove();
  }
  function addOutline(base, items) {
    var PL = window.PDFLib, ctx = base.context, cat = base.catalog, N = PL.PDFName.of.bind(PL.PDFName);
    var outRef = cat.get(N('Outlines')), out = outRef ? ctx.lookup(outRef, PL.PDFDict) : null;
    if (!out) { out = ctx.obj({ Type: 'Outlines', Count: 0 }); outRef = ctx.register(out); cat.set(N('Outlines'), outRef); }
    var cnt = out.get(N('Count')); cnt = cnt && cnt.asNumber ? cnt.asNumber() : 0; if (cnt < 0) cnt = -cnt;
    items.forEach(function (it) {
      var d = ctx.obj({ Title: PL.PDFHexString.fromText('Merged: ' + it.label), Parent: outRef, Dest: [it.ref, N('Fit')] }), ref = ctx.register(d), last = out.get(N('Last'));
      if (last) { d.set(N('Prev'), last); ctx.lookup(last, PL.PDFDict).set(N('Next'), ref); } else out.set(N('First'), ref);
      out.set(N('Last'), ref); cnt++;
    });
    out.set(N('Count'), PL.PDFNumber.of(cnt));
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj();
    if (act === 'mergeopen') {
      mg = { map: null, base: null, basePages: 0, docs: [], busy: false }; mergeModal();
      pageMapFor(p).then(function (m) { mg.map = m; mg.docs.forEach(function (d) { d.pos = guessPos(d.file.name); }); mergeModal(); }, function (err) { closeModal(); toast('⚠ ' + (err && err.message || err), 6000); });
    }
    else if (act === 'mgrm') { mg.docs.splice(+el.dataset.i, 1); mergeModal(); }
    else if (act === 'mgrun') { if (mg.busy) return; mg.busy = true; el.disabled = true; mergeRun().then(function () { mg.busy = false; closeModal(); toast('Merged PDF downloaded.', 5000); }, function (err) { mg.busy = false; el.disabled = false; var st = $('#mgstatus'); if (st) { st.style.color = '#a33'; st.textContent = 'Could not merge: ' + (err && err.message || err); } }); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset) return;
    if (t.dataset.mgbase !== undefined && t.files.length) {
      mg.base = t.files[0]; mg.basePages = 0; mergeModal();
      readBuf(mg.base).then(function (u8) { return window.PDFLib.PDFDocument.load(u8, { ignoreEncryption: true, updateMetadata: false }); }).then(function (d) { mg.basePages = d.getPageCount(); mergeModal(); }, function () { mg.base = null; mergeModal(); toast('That PDF could not be opened.'); });
    }
    else if (t.dataset.mgdocs !== undefined && t.files.length) { mgAdd([].slice.call(t.files)); }
    else if (t.dataset.mglabel !== undefined) mg.docs[+t.dataset.mglabel].label = t.value;
    else if (t.dataset.mgpos !== undefined) { mg.docs[+t.dataset.mgpos].pos = t.value; mergeModal(); }
    else if (t.dataset.mgpage !== undefined) mg.docs[+t.dataset.mgpage].page = t.value;
  });
})();


/* ================= CONSULTANTS: add consultants' finished PDF specs to the manual and table of contents (no AI) ================= */
(function () {
  var DISC = ['Civil', 'Structural', 'Mechanical', 'Plumbing', 'Electrical', 'Mechanical / Electrical / Plumbing', 'Fire protection', 'Landscape', 'Low voltage / technology', 'Kitchen / food service', 'Lighting', 'Acoustical'];
  var DIVN = { Civil: '31', Structural: '05', Mechanical: '23', Plumbing: '22', Electrical: '26', 'Mechanical / Electrical / Plumbing': '23', 'Fire protection': '21', Landscape: '32', 'Low voltage / technology': '27', 'Kitchen / food service': '11', Lighting: '26', Acoustical: '09' };
  /* PDF files stay in this browser (IndexedDB). Only the list is saved with the project. */
  var idb = null;
  function db() {
    return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('slatespecs_files', 1); r.onupgradeneeded = function () { r.result.createObjectStore('f'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }));
  }
  function tx(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('f', mode), st = t.objectStore('f'), q = fn(st); t.oncomplete = function () { res(q && q.result); }; t.onerror = function () { rej(t.error); }; }); }); }
  function fput(id, blob) { return tx('readwrite', function (s) { return s.put(blob, id); }); }
  function fget(id) { return tx('readonly', function (s) { return s.get(id); }); }
  function fdel(id) { return tx('readwrite', function (s) { return s.delete(id); }); }
  window.__fs = { put: fput, get: fget, del: fdel };
  var have = {};   // id -> true when the PDF is on this device
  function divOptions(sel) { return Object.keys(SS.DIVISIONS).sort().map(function (d) { return '<option value="' + d + '"' + (sel === d ? ' selected' : '') + '>' + parseInt(d, 10) + ' – ' + esc(SS.DIVISIONS[d]) + '</option>'; }).join(''); }
  window.viewConsultants = function (p) {
    var L = p.consultants || [];
    (L).forEach(function (c) { if (have[c.id] === undefined) { have[c.id] = false; fget(c.id).then(function (b) { have[c.id] = !!b; if (ui.tab === 'consultants') render(); }, function () {}); } });
    var rows = L.map(function (c, i) {
      return '<tr><td style="white-space:nowrap"><button class="btn sm" data-act="consup" data-i="' + i + '"' + (i ? '' : ' disabled') + '>↑</button><button class="btn sm" data-act="consdn" data-i="' + i + '"' + (i < L.length - 1 ? '' : ' disabled') + '>↓</button></td>' +
        '<td><input type="text" list="consdisc" data-cf="discipline" data-i="' + i + '" value="' + esc(c.discipline || '') + '" style="width:150px;padding:4px 6px" placeholder="Discipline"></td>' +
        '<td><input type="text" data-cf="title" data-i="' + i + '" value="' + esc(c.title || '') + '" style="width:100%;padding:4px 6px" placeholder="Document title"></td>' +
        '<td><select data-cf="div" data-i="' + i + '">' + divOptions(c.div) + '</select></td>' +
        '<td><input type="text" data-cf="number" data-i="' + i + '" value="' + esc(c.number || '') + '" style="width:110px;padding:4px 6px" placeholder="23 00 00"></td>' +
        '<td><input type="text" data-cf="issue" data-i="' + i + '" value="' + esc(c.issue || '') + '" style="width:110px;padding:4px 6px" placeholder="issue date"></td>' +
        '<td class="small" style="white-space:nowrap">' + (c.pages || '?') + ' pp' + (have[c.id] === false ? '<div style="color:#a33">PDF not on this device <label class="btn sm" style="cursor:pointer">Attach<input type="file" accept=".pdf,application/pdf" data-consre="' + esc(c.id) + '" style="display:none"></label></div>' : '') + '</td>' +
        '<td><button class="btn sm danger" data-act="consdel" data-i="' + i + '">✕</button></td></tr>';
    }).join('');
    var missing = L.filter(function (c) { return have[c.id] === false; }).length;
    return '<div class="wrap"><div class="panel"><h2>Consultant specifications</h2><div class="small muted" style="margin-bottom:10px">Add each consultant’s finished specification as a PDF. Nothing is read by the AI and nothing is sorted: the documents go into the manual and the table of contents exactly as you list them, in the order shown here. Each one is listed under its division with its page count.</div>' +
      '<label class="dz" data-dz="cons"><span class="dzt">✨ Drop consultant specification PDFs here</span><span class="dzs">or click to browse. One PDF per discipline or division.</span><input type="file" multiple accept=".pdf,application/pdf" data-consfile style="display:none"></label><datalist id="consdisc">' + DISC.map(function (d) { return '<option value="' + esc(d) + '">'; }).join('') + '</datalist>' +
      (rows ? '<div style="overflow:auto;margin-top:10px"><table class="tbl"><tr><th>Order</th><th>Discipline</th><th>Title</th><th>Division</th><th>Section no(s).</th><th>Issue date</th><th>Pages</th><th></th></tr>' + rows + '</table></div>' : '<div class="empty" style="margin-top:10px">No consultant specifications added yet.</div>') + '<div class="small" id="consmsg" style="margin-top:6px;min-height:16px"></div></div>' +
      '<div class="panel"><h2>Add them to the manual</h2><div class="small muted" style="margin-bottom:8px">The <b>table of contents</b> lists every document above, in the PDF and the Word file, under its division. To put the <b>pages</b> into the PDF: export the manual to PDF the usual way (Issue / export, PDF button, Save as PDF), then choose that file below. Slate inserts each consultant PDF at the end of its division and adds a bookmark for it. Word files get the table of contents rows only, because Word cannot hold a PDF; add those pages from the PDF.' + (missing ? ' <span style="color:#a33">' + missing + ' PDF' + (missing > 1 ? 's are' : ' is') + ' not on this device. Attach them first.</span>' : '') + '</div>' +
      '<div class="row"><input type="file" accept=".pdf,application/pdf" data-consbase><button class="btn pri" data-act="consmerge" disabled id="consmerge">Merge into the manual PDF</button></div><div class="small" id="consrun" style="margin-top:6px;min-height:16px"></div></div></div>';
  };
  window.__consCopy = async function (list) {
    var out = [];
    for (var i = 0; i < list.length; i++) { var c = Object.assign({}, list[i]), old = c.id; c.id = SS.uid(); try { var b = await fget(old); if (b) { await fput(c.id, b); have[c.id] = true; } else have[c.id] = false; } catch (e) { have[c.id] = false; } out.push(c); }
    return out;
  };
  window.consAdd = async function (files) {
    var p = proj(), n = 0, msg = $('#consmsg'); p.consultants = p.consultants || [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i]; if (!/\.pdf$/i.test(f.name)) continue;
      try {
        var u8 = await readBuf(f), d = await window.PDFLib.PDFDocument.load(u8, { ignoreEncryption: true, updateMetadata: false }), id = SS.uid();
        await fput(id, new Blob([u8], { type: 'application/pdf' })); have[id] = true;
        var nm = f.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '), disc = DISC.filter(function (x) { return nm.toLowerCase().indexOf(x.toLowerCase().split(' ')[0]) >= 0; })[0] || '';
        p.consultants.push({ id: id, discipline: disc, title: nm, div: DIVN[disc] || '23', number: '', issue: '', pages: d.getPageCount(), file: f.name }); n++;
      } catch (err) { toast('⚠ ' + f.name + ': ' + (err && err.message || err), 6000); }
    }
    if (n) { saveProjects(); render(); }
  };
  async function consMerge() {
    var p = proj(), PL = window.PDFLib, say = function (t, bad) { var el = $('#consrun'); if (el) { el.style.color = bad ? '#a33' : ''; el.textContent = t; } };
    var base = $('[data-consbase]').files[0]; if (!base) return;
    var list = (p.consultants || []).slice(); if (!list.length) return say('Add consultant PDFs first.', true);
    say('Reading the manual layout…'); var map = await window.__mk.pageMapFor(p);
    var basePdf = await PL.PDFDocument.load(await readBuf(base), { ignoreEncryption: true, updateMetadata: false }), warn = basePdf.getPageCount() !== map.total;
    if (warn && !confirm('The PDF has ' + basePdf.getPageCount() + ' pages but Slate expects ' + map.total + '. Positions may be off. Merge anyway?')) return say('');
    var jobs = [];
    for (var k = 0; k < list.length; k++) {
      var c = list[k], blob = await fget(c.id); if (!blob) throw new Error('“' + c.title + '” is not on this device. Attach its PDF first.');
      var at = map.total, dv = parseInt(c.div, 10);
      for (var q = 0; q < map.pts.length; q++) { var x = map.pts[q]; if (x.kind === 'sec' && parseInt(SS.divOf(x.label.split(' ')[0] + ' ' + x.label.split(' ')[1]), 10) > dv) { at = x.at; break; } }
      jobs.push({ c: c, k: k, at: at, blob: blob });
    }
    jobs.sort(function (a, b) { return b.at - a.at || b.k - a.k; }); var added = [];
    for (var j = 0; j < jobs.length; j++) {
      say('Merging ' + (j + 1) + ' of ' + jobs.length + ': ' + jobs[j].c.title + '…');
      var src = await PL.PDFDocument.load(await readBuf(jobs[j].blob), { ignoreEncryption: true, updateMetadata: false });
      var pages = await basePdf.copyPages(src, src.getPageIndices()); pages.forEach(function (pg, n) { basePdf.insertPage(jobs[j].at + n, pg); });
      added.push({ k: jobs[j].k, label: [jobs[j].c.discipline, jobs[j].c.title].filter(Boolean).join(' – '), ref: pages[0].ref });
    }
    added.sort(function (a, b) { return a.k - b.k; }); window.__mk.addOutline(basePdf, added);
    say('Saving…'); var bytes = await basePdf.save();
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = ((p.number ? p.number + ' ' : '') + (p.name || 'Project') + ' - Project Manual (with consultants).pdf').replace(/[\\/:*?"<>|]/g, ''); document.body.appendChild(a); a.click(); a.remove();
    say('Done. The merged PDF was downloaded.');
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset) return; var p = proj();
    if (t.dataset.consfile !== undefined && t.files.length) { var fs = [].slice.call(t.files); t.value = ''; consAdd(fs); }
    else if (t.dataset.consbase !== undefined) { var b = $('#consmerge'); if (b) b.disabled = !t.files.length; }
    else if (t.dataset.consre !== undefined && t.files.length) {
      var f = t.files[0], id = t.dataset.consre; readBuf(f).then(function (u8) { return fput(id, new Blob([u8], { type: 'application/pdf' })); }).then(function () { have[id] = true; render(); toast('Attached'); }, function (er) { toast('⚠ ' + er.message); });
    }
    else if (t.dataset.cf !== undefined && p) {
      var c = (p.consultants || [])[+t.dataset.i]; if (!c) return; c[t.dataset.cf] = t.value.trim();
      if (t.dataset.cf === 'discipline' && DIVN[c.discipline]) { c.div = DIVN[c.discipline]; render(); }
      saveSoon();
    }
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj();
    if (act === 'consup' || act === 'consdn') { var i = +el.dataset.i, j = act === 'consup' ? i - 1 : i + 1, L = p.consultants; if (j < 0 || j >= L.length) return; var t = L[i]; L[i] = L[j]; L[j] = t; saveProjects(); render(); }
    else if (act === 'consdel') { var c = p.consultants[+el.dataset.i]; if (!confirm('Remove “' + c.title + '” from this project? Its PDF is deleted from this device.')) return; p.consultants.splice(+el.dataset.i, 1); fdel(c.id).catch(function () {}); delete have[c.id]; saveProjects(); render(); }
    else if (act === 'consmerge') { el.disabled = true; consMerge().then(function () { el.disabled = false; }, function (err) { el.disabled = false; var r = $('#consrun'); if (r) { r.style.color = '#a33'; r.textContent = 'Could not merge: ' + (err && err.message || err); } }); }
  });
})();


/* ================= USABILITY: duplicate, find, new-project wizard, overview, section history ================= */
(function () {
  var TYPE_OF = function (p) { return p.ptype ? SS.PTYPE_LABELS[p.ptype] : ''; };

  /* ---------- 5. section history / undo (captures every body change at save time) ---------- */
  var lastBody = {}, lastEdit = {}, sp0 = saveProjects;
  function histKey(p, s) { return p.id + '|' + s.code; }
  function histBase(p) { p.sections.forEach(function (s) { var k = histKey(p, s); if (lastBody[k] === undefined) lastBody[k] = s.body; }); }
  function histObserve(typing) {
    var now = Date.now();
    projects.forEach(function (p) {
      p.sections.forEach(function (s) {
        var k = histKey(p, s), prev = lastBody[k];
        if (prev === undefined) { lastBody[k] = s.body; return; }
        if (prev === s.body) return;
        var gap = now - (lastEdit[k] || 0), big = Math.abs(prev.length - s.body.length) > 500;
        if (prev.trim() && (!typing || big || gap > 60000)) {
          var h = s.hist = s.hist || [];
          h.unshift({ body: prev, at: now, why: typing ? (big ? 'Before a large edit' : 'Before editing') : 'Before a change (AI, library or import)' });
          if (h.length > 6) h.length = 6;
        }
        lastEdit[k] = now; lastBody[k] = s.body;
      });
    });
  }
  saveProjects = function () { var t = !!ui.typing; ui.typing = false; histObserve(t); sp0(); };
  var viewProject0 = viewProject;
  viewProject = function () { var p = proj(); if (p) histBase(p); return viewProject0(); };
  function ago(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; }
  function histRestore(p, s, i) {
    var h = s.hist, pv = h[i]; if (!pv) return; var cur = s.body;
    h.splice(i, 1); h.unshift({ body: cur, at: Date.now(), why: 'Before restoring an earlier version' }); if (h.length > 6) h.length = 6;
    s.body = pv.body; lastBody[histKey(p, s)] = s.body; lastEdit[histKey(p, s)] = Date.now(); sp0(); render();
  }
  function histModal(p, s, open) {
    var h = s.hist || [];
    modal('<h2>History – ' + esc(s.code) + ' ' + esc(s.title) + '</h2><div class="small muted" style="margin-bottom:8px">Earlier versions of this section’s text, saved automatically before AI rewrites, library changes, imports and larger edits. Restoring keeps your current text in the list, so you can switch back.</div>' +
      (h.length ? h.map(function (x, i) {
        var ops = open === i ? SS.diffLines(x.body, s.body) : null, ds = ops ? SS.diffStats(ops) : null;
        return '<div style="border-bottom:1px solid var(--line2);padding:8px 0"><div class="row"><b>' + ago(x.at) + '</b><span class="small muted">' + esc(x.why) + ' • ' + x.body.split('\n').length + ' lines</span><div class="sp"></div><button class="btn sm" data-act="histcmp" data-i="' + i + '">' + (open === i ? 'Hide' : 'Compare with now') + '</button><button class="btn sm pri" data-act="histrestore" data-i="' + i + '">Restore</button></div>' +
          (ops ? '<div class="small muted" style="margin:6px 0"><span class="badge r">− that version</span> <span class="badge g">+ now</span> • ' + ds.add + ' lines added, ' + ds.del + ' removed</div><style>' + SS.REDLINE_CSS + '</style><div style="max-height:34vh;overflow:auto;border-radius:12px;background:var(--inset);padding:6px 0">' + (ds.changed ? SS.redlineHtml(ops, 3) : '<div class="empty">Same as now.</div>') + '</div>' : '') + '</div>';
      }).join('') : '<div class="empty">No earlier versions yet. They are saved as you work.</div>') +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Close</button></div>', true);
  }

  /* ---------- 1. duplicate project ---------- */
  var dup = null;
  function dupModal() {
    var src = projects.filter(function (x) { return x.id === dup.id; })[0]; if (!src) return;
    modal('<h2>Duplicate project</h2><div class="small muted" style="margin-bottom:8px">Start a new project from “' + esc(src.name || 'Untitled') + '”. The project number, owner, address, issue date, issue history, submittals, notes and sources are not copied.</div>' +
      '<div class="two"><div class="fld"><label>New project name</label><input type="text" id="dupname" value="' + esc(dup.name) + '"></div><div class="fld"><label>Project number</label><input type="text" id="dupnum" placeholder="optional"></div></div>' +
      '<div class="fld"><label>Sections</label><label class="small" style="display:block"><input type="radio" name="dupmode" value="text" checked> Copy the section text and answers as they are</label><label class="small" style="display:block"><input type="radio" name="dupmode" value="list"> Copy only the list of sections, with fresh master text and blank answers</label></div>' +
      '<label class="small" style="display:block"><input type="checkbox" id="dupcode" checked> Keep the building code and contract form</label>' +
      '<label class="small" style="display:block"><input type="checkbox" id="dupteam"> Keep the design team (interior, structural, CM, MEP, civil, landscape)</label>' +
      '<label class="small" style="display:block"><input type="checkbox" id="dupcons"> Keep the consultant specification list and PDFs</label>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" data-act="dupgo">Create copy</button></div>');
  }
  async function dupGo() {
    var src = projects.filter(function (x) { return x.id === dup.id; })[0]; if (!src) return;
    var name = ($('#dupname').value || '').trim(); if (!name) return toast('Give the copy a name.');
    var mode = (document.querySelector('[name=dupmode]:checked') || {}).value, np = { id: SS.uid(), created: Date.now(), sections: [], notes: '', name: name, number: ($('#dupnum').value || '').trim(), ptype: src.ptype || '', architect: src.architect || settings.architect || 'ai3, Inc.', phase: '' };
    if ($('#dupcode').checked) { np.code = src.code || ''; np.contractForm = src.contractForm || ''; }
    if ($('#dupteam').checked) ['interior', 'structural', 'cm', 'mep', 'civil', 'landscape'].forEach(function (k) { np[k] = src[k] || ''; });
    if (mode === 'text') np.sections = clone(src.sections).map(function (s) { s.hist = []; s.status = 'draft'; return s; });
    else addSections(np, src.sections.map(function (s) { return s.code; }));
    if ($('#dupcons').checked && (src.consultants || []).length) np.consultants = await window.__consCopy(src.consultants);
    projects.unshift(np); saveProjects(); closeModal(); ui.view = 'project'; ui.pid = np.id; ui.tab = 'overview'; ui.code = np.sections[0] && np.sections[0].code; render(); toast('Copied. Review the project information next.', 5000);
  }

  /* ---------- 2. find in project ---------- */
  var fnd = { idx: [], q: '' };
  function findOpen() {
    var p = proj(); if (!p) return;
    fnd.idx = p.sections.map(function (s) { return { kind: 'sec', code: s.code, title: s.title, on: s.on, text: s.body.trim() ? projTxt(p, s) : '' }; })
      .concat((p.consultants || []).map(function (c) { return { kind: 'cons', code: '', title: c.title, text: [c.discipline, c.number, c.title].join(' ') }; }))
      .concat((p.products || []).map(function (x) { return { kind: 'prod', code: x.code, title: x.manufacturer + ' ' + x.productName, text: [x.manufacturer, x.productName, x.code].join(' ') }; }));
    modal('<h2>Find in this project</h2><div class="fld"><input type="text" id="findq" placeholder="Search every section’s text: a product, a standard, a phrase, “Section 09 260”…" autocomplete="off"></div><div id="findres" style="max-height:56vh;overflow:auto"><div class="small muted">Type to search ' + p.sections.length + ' sections.</div></div><div class="mfoot"><button class="btn" data-act="closemodal">Close</button></div>', true);
    setTimeout(function () { var i = $('#findq'); if (i) i.focus(); }, 30);
  }
  function findRun() {
    var q = (($('#findq') || {}).value || '').trim().toLowerCase(), el = $('#findres'); if (!el) return;
    if (q.length < 2) { el.innerHTML = '<div class="small muted">Type at least two letters.</div>'; return; }
    var words = q.split(/\s+/), out = [];
    fnd.idx.forEach(function (x) {
      var hay = (x.code + ' ' + x.title + ' ' + x.text).toLowerCase(); if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
      var tl = x.text.toLowerCase(), at = tl.indexOf(words[0]), n = 0, i = -1; while ((i = tl.indexOf(words[0], i + 1)) >= 0 && n < 99) n++;
      var sn = at >= 0 ? x.text.slice(Math.max(0, at - 60), at + 110).replace(/\s+/g, ' ') : '';
      out.push({ x: x, n: n + (x.title.toLowerCase().indexOf(words[0]) >= 0 ? 5 : 0), sn: sn, off: x.at });
    });
    out.sort(function (a, b) { return b.n - a.n; });
    var mark = function (t) { var h = esc(t); words.forEach(function (w) { h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); }); return h; };
    el.innerHTML = (out.length ? '<div class="small muted" style="margin-bottom:4px">' + out.length + ' result' + (out.length > 1 ? 's' : '') + '</div>' : '<div class="empty">Nothing found.</div>') + out.slice(0, 80).map(function (r) {
      var x = r.x; return '<div class="sec" style="cursor:pointer;display:block;padding:8px 10px" data-act="' + (x.kind === 'sec' ? 'gotosec' : x.kind === 'cons' ? 'gotoconsult' : 'gotoprod') + '" data-code="' + esc(x.code) + '"><div><span class="c">' + esc(x.code || (x.kind === 'cons' ? 'Consultant' : '')) + '</span> <b>' + mark(x.title) + '</b>' + (x.kind === 'sec' && !x.on ? ' <span class="badge n">not included</span>' : '') + (r.n > 1 ? ' <span class="small muted">' + r.n + ' matches</span>' : '') + '</div>' + (r.sn ? '<div class="small muted" style="margin-top:2px">…' + mark(r.sn) + '…</div>' : '') + '</div>';
    }).join('');
  }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && ui.view === 'project') { e.preventDefault(); findOpen(); }
    else if (e.key === '/' && ui.view === 'project' && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') && !(e.target || {}).isContentEditable) { e.preventDefault(); findOpen(); }
  });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'findq') { clearTimeout(findRun.t); findRun.t = setTimeout(findRun, 120); } });

  /* ---------- 3. new-project wizard (keeps the #npf / #npstart / createproj ids) ---------- */
  var wiz = { step: 1 };
  function wf(k, l, ph) { var fm = settings.firm || {}, dv = k === 'code' ? fm.defCode : k === 'contractForm' ? fm.defContract : k === 'architect' ? (fm.name || settings.architect) : ''; return '<div class="fld"><label>' + l + '</label><input type="text" data-pf="' + k + '" value="' + esc(dv || '') + '" placeholder="' + esc(ph || '') + '"></div>'; }
  function wizOpen() {
    var ts = typeSets(); wiz = { step: 1 };
    var opts = SS.PTYPES.map(function (t) { return '<option value="t:' + t + '">' + esc(SS.PTYPE_LABELS[t]) + ' set (' + (ts[t] || []).length + ' sections)</option>'; }).join('') + SS.STARTERS.map(function (s, i) { return '<option value="s:' + i + '">' + esc(s.name) + ' (' + s.codes.length + ' sections)</option>'; }).join('');
    var phases = ['Schematic Design', 'Design Development', 'Permit Set', 'Construction Documents', 'Bid Set', 'Issued for Construction', 'Released for Construction'];
    modal('<h2>New project <span class="small muted" id="wizstep"></span></h2><div id="npf">' +
      '<div data-wiz="1"><div class="two">' + wf('name', 'Project name', 'River North Wellness Hotel') + wf('number', 'Project number') + '</div>' +
      '<div class="two"><div class="fld"><label>Project type</label><select data-pf="ptype"><option value="">(not set)</option>' + SS.PTYPES.map(function (t) { return '<option value="' + t + '">' + esc(SS.PTYPE_LABELS[t]) + '</option>'; }).join('') + '</select></div>' + wf('owner', 'Owner') + '</div>' +
      '<div class="two">' + wf('address', 'Street address') + wf('cityState', 'City, State', 'Fort Lauderdale, FL') + '</div>' +
      '<div class="two"><div class="fld"><label>Issue phase</label><select data-pf="phase"><option value=""></option>' + phases.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>' + wf('issueDate', 'Issue date', 'December 12, 2026') + '</div></div>' +
      '<div data-wiz="2" style="display:none"><div class="two">' + wf('code', 'Governing building code', 'Florida Building Code, Building, 8th Edition (2023)') + wf('contractForm', 'Contract form', 'AIA A201-2017') + '</div>' +
      '<div class="two">' + wf('architect', 'Architect of record', settings.architect || 'ai3, Inc.') + wf('contractor', 'Contractor (if known)') + wf('interior', 'Interior designer') + wf('structural', 'Structural engineer') + wf('cm', 'Construction management') + wf('mep', 'MEP engineer') + wf('civil', 'Civil engineer') + wf('landscape', 'Landscape architect') + '</div></div></div>' +
      '<div data-wiz="3" style="display:none"><div class="fld"><label>Starting set of sections</label><select id="npstart">' + opts + '</select></div><div class="small muted" id="wizsum"></div><div class="small muted" style="margin-top:8px">The cover page and table of contents are built from what you entered. You can change any of it later on the Project info tab. To start from a finished project instead, close this and use Duplicate on that project.</div></div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn" data-act="wizback" id="wizback" style="display:none">Back</button><button class="btn pri" data-act="wiznext" id="wiznext">Next</button><button class="btn pri" data-act="createproj" id="wizgo" style="display:none">Create project</button></div>');
    wizShow();
  }
  function wizShow() {
    [].forEach.call(document.querySelectorAll('[data-wiz]'), function (d) { d.style.display = +d.dataset.wiz === wiz.step ? '' : 'none'; });
    var g = function (id, v) { var el = $(id); if (el) el.style.display = v ? '' : 'none'; };
    g('#wizback', wiz.step > 1); g('#wiznext', wiz.step < 3); g('#wizgo', wiz.step === 3);
    var st = $('#wizstep'); if (st) st.textContent = '• step ' + wiz.step + ' of 3: ' + ['The project', 'Team and contract', 'Sections'][wiz.step - 1];
    if (wiz.step === 3) { var v = $('#npstart').value, n = v.indexOf('t:') === 0 ? (typeSets()[v.slice(2)] || []).length : SS.STARTERS[+v.slice(2)].codes.length, name = (document.querySelector('#npf [data-pf=name]') || {}).value || 'This project'; $('#wizsum').textContent = name + ' will start with ' + n + ' sections.'; }
    var f = document.querySelector('[data-wiz="' + wiz.step + '"] input'); if (f) setTimeout(function () { f.focus(); }, 20);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && wiz && document.getElementById('wizgo') && /INPUT/.test((e.target || {}).tagName || '') && e.target.type === 'text') { e.preventDefault(); var n = $('#wiznext'); if (n && n.style.display !== 'none') n.click(); else $('#wizgo').click(); } });

  /* ---------- 4. overview ---------- */
  window.viewOverview = function (p) {
    var st = projStats(p), on = p.sections.filter(function (s) { return s.on; }), withText = on.filter(function (s) { return s.body.trim(); }),
      cnt = { final: 0, review: 0, draft: 0 }; withText.forEach(function (s) { cnt[s.status === 'final' ? 'final' : s.status === 'review' ? 'review' : 'draft']++; });
    var ck = issueCheck(p), pct = on.length ? Math.round(100 * st.fin / on.length) : 0, steps = [];
    var add = function (txt, go, label, extra) { steps.push('<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line2)"><span style="flex:1">' + txt + '</span><button class="btn sm" data-act="ovgo" data-go="' + go + '"' + (extra || '') + '>' + label + '</button></div>'); };
    if (!p.ptype) add('Pick a <b>project type</b> so Slate can suggest the right sections.', 'info', 'Project info');
    var missInfo = ck.warn.filter(function (x) { return !x.code && /Project information missing/.test(x.text); })[0]; if (missInfo) add(esc(missInfo.text), 'info', 'Fill in');
    var set = p.ptype ? (typeSets()[p.ptype] || []) : [], miss = set.filter(function (c) { return !p.sections.some(function (s) { return s.code === c; }); });
    if (miss.length) add('<b>' + miss.length + '</b> section' + (miss.length > 1 ? 's' : '') + ' in the ' + esc(TYPE_OF(p)) + ' set ' + (miss.length > 1 ? 'are' : 'is') + ' not in this project: ' + esc(miss.slice(0, 5).join(', ')) + (miss.length > 5 ? '…' : ''), 'typeadd', 'Add them');
    var empty = on.filter(function (s) { return !s.body.trim(); }); if (empty.length) add('<b>' + empty.length + '</b> included section' + (empty.length > 1 ? 's have' : ' has') + ' no text: ' + esc(empty.slice(0, 4).map(function (s) { return s.code; }).join(', ')) + (empty.length > 4 ? '…' : ''), 'sec:' + empty[0].code, 'Open first');
    var open = ck.block.filter(function (x) { return x.code && x.text !== 'Included but has no text.' && !/Coordination conflict/.test(x.text); });
    if (open.length) add('<b>' + open.length + '</b> section' + (open.length > 1 ? 's have' : ' has') + ' open questions or [brackets]: ' + esc(open.slice(0, 4).map(function (x) { return x.code; }).join(', ')) + (open.length > 4 ? '…' : ''), 'sec:' + open[0].code, 'Open first');
    var conf = ck.block.filter(function (x) { return /Coordination conflict/.test(x.text); }); if (conf.length) add('<b>' + conf.length + '</b> coordination conflict' + (conf.length > 1 ? 's' : '') + ' still open.', 'coord', 'Coordination');
    var newer = ck.warn.filter(function (x) { return /newer revision/.test(x.text); }); if (newer.length) add('<b>' + newer.length + '</b> section' + (newer.length > 1 ? 's have' : ' has') + ' a newer master revision.', 'sec:' + newer[0].code, 'Review');
    var nf = withText.filter(function (s) { return s.status !== 'final'; }).length; if (!open.length && !empty.length && nf) add('<b>' + nf + '</b> section' + (nf > 1 ? 's are' : ' is') + ' not marked Final.', 'sec:' + withText.filter(function (s) { return s.status !== 'final'; })[0].code, 'Review');
    var iss = p.issues || []; if (!iss.length) add('No issue has been frozen yet. Freeze one when you send the set out, so changes can be compared later.', 'export', 'Issue / export');
    if (!steps.length) steps.push('<div class="row" style="padding:8px 0"><span style="flex:1"><b>Everything is complete.</b> Every included section has text, no open items, and is marked Final.</span><button class="btn pri" data-act="ovgo" data-go="export">Issue / export</button></div>');
    var box = function (n, l, c) { return '<div style="flex:1;min-width:120px;border:1px solid var(--line2);border-radius:12px;padding:10px 12px"><div style="font-size:22px;font-weight:700"' + (c ? ' style="color:' + c + '"' : '') + '>' + n + '</div><div class="small muted">' + l + '</div></div>'; };
    var last = iss.length ? iss[iss.length - 1] : null;
    return '<div class="wrap"><div class="row"><div><h1 style="margin:0">' + esc(p.name || 'Untitled') + '</h1><div class="muted small">' + esc([p.number, TYPE_OF(p), p.phase, p.issueDate].filter(Boolean).join(' • ')) + '</div></div><div class="sp"></div><button class="btn" data-act="pdf" data-scope="all">Export PDF</button><button class="btn" data-act="docx" data-scope="all">Export Word</button></div>' +
      '<div class="panel"><div class="row" style="gap:10px;flex-wrap:wrap">' + box(on.length, 'sections included') + box(cnt.final, 'final') + box(cnt.review, 'in review') + box(cnt.draft, 'draft') + box(empty.length, 'with no text') + box(st.open, 'open items') + '</div><div class="bar" style="margin-top:12px"><i style="width:' + pct + '%"></i></div><div class="small muted" style="margin-top:4px">' + pct + '% of included sections are marked Final</div></div>' +
      '<div class="panel"><h2>What to do next</h2>' + steps.join('') + '</div>' +
      '<div class="panel"><h2>At a glance</h2><div class="small" style="line-height:1.8">Last issue: <b>' + (last ? esc(last.name) + ' • ' + esc(last.date || '') : 'none yet') + '</b><br>Consultant specifications: <b>' + (p.consultants || []).length + '</b> • Products specified: <b>' + (p.products || []).length + '</b> • Modifications applied: <b>' + (p.mods || []).length + '</b><br>Submittal register: <b>' + p.sections.filter(function (s) { return s.on; }).length + '</b> included sections</div></div></div>';
  };

  /* ---------- handlers ---------- */
  newProjectModal = wizOpen;
  document.addEventListener('change', function (e) {
    var t = e.target; if (t && t.id === 'npstart' && wiz.step === 3) wizShow();
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj();
    if (act === 'gotosec' && el.closest('#findres')) closeModal();
    if (act === 'wiznext') {
      if (wiz.step === 1 && !(($('#npf [data-pf=name]') || {}).value || '').trim()) return toast('Give the project a name.');
      wiz.step++; wizShow();
    }
    else if (act === 'wizback') { wiz.step--; wizShow(); }
    else if (act === 'dupopen') { var src = projects.filter(function (x) { return x.id === (el.dataset.id || ui.pid); })[0]; if (!src) return; e.stopPropagation(); dup = { id: src.id, name: (src.name || 'Untitled') + ' (copy)' }; dupModal(); }
    else if (act === 'dupgo') { dupGo().catch(function (err) { toast('⚠ ' + (err && err.message || err), 6000); }); }
    else if (act === 'findopen') findOpen();
    else if (act === 'gotoconsult') { closeModal(); ui.tab = 'consultants'; render(); }
    else if (act === 'gotoprod') { closeModal(); ui.tab = 'products'; render(); }
    else if (act === 'ovgo') {
      var g = el.dataset.go; if (g.indexOf('sec:') === 0) { ui.tab = 'sections'; ui.code = g.slice(4); ui.editText = false; render(); }
      else if (g === 'typeadd') { if (p && p.ptype) { var b = p.sections.length; addSections(p, typeSets()[p.ptype] || []); saveProjects(); render(); toast((p.sections.length - b) + ' sections added'); } }
      else { ui.tab = g; render(); }
    }
    else if (act === 'histundo') { var s = p && p.sections.filter(function (x) { return x.code === ui.code; })[0]; if (!s) return; if (!(s.hist || []).length) return toast('Nothing earlier to go back to yet.'); histRestore(p, s, 0); toast('Put back the earlier text. Use History to switch again.', 4000); }
    else if (act === 'histopen') { var s2 = p && p.sections.filter(function (x) { return x.code === ui.code; })[0]; if (s2) histModal(p, s2, -1); }
    else if (act === 'histcmp') { var s3 = p.sections.filter(function (x) { return x.code === ui.code; })[0], i = +el.dataset.i; histModal(p, s3, ui.histOpen === i ? -1 : i); ui.histOpen = ui.histOpen === i ? -1 : i; }
    else if (act === 'histrestore') { var s4 = p.sections.filter(function (x) { return x.code === ui.code; })[0]; closeModal(); histRestore(p, s4, +el.dataset.i); toast('Restored', 3000); }
  });
})();

/* ================= WORKFLOW: comments, section navigation, export presets, guided issue, help, restore points, backup reminder, firm profile ================= */
(function () {
  var DAY = 86400000;
  function agoT(t) { if (!t) return ''; var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; }
  function openCm(s) { return (s.cmts || []).filter(function (c) { return !c.done; }); }
  function secOf(p) { return p.sections.filter(function (x) { return x.code === ui.code; })[0]; }

  /* ---------- 6. comments & flags ---------- */
  function cmtPanel(s) {
    var l = s.cmts || [], n = openCm(s).length;
    return '<div class="panel"><h2>Comments &amp; flags' + (n ? ' <span class="badge r">' + n + ' open</span>' : '') + '</h2>' +
      (l.length ? l.map(function (c, i) { return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--line2)"><input type="checkbox" data-act="cmttog" data-i="' + i + '"' + (c.done ? ' checked' : '') + ' title="Mark resolved"><span style="flex:1;' + (c.done ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(c.text) + '<span class="small muted"> — ' + esc(c.by || '') + ' ' + agoT(c.at) + '</span></span><button class="btn sm" data-act="cmtdel" data-i="' + i + '" title="Delete">×</button></div>'; }).join('') : '<div class="small muted">Nothing yet. Use this for things to check, questions for the owner or reminders to yourself. Comments never print in the manual.</div>') +
      '<div class="row" style="margin-top:8px"><input type="text" id="cmtnew" placeholder="Add a comment or flag…" style="flex:1"><button class="btn sm pri" data-act="cmtadd">Add</button></div></div>';
  }
  var ic0 = issueCheck;
  issueCheck = function (p) {
    var r = ic0(p);
    p.sections.forEach(function (s) { if (!s.on) return; var n = openCm(s).length; if (n) r.warn.push({ code: s.code, text: n + ' open comment' + (n > 1 ? 's' : '') + ': ' + openCm(s)[0].text.slice(0, 80) }); });
    return r;
  };

  /* ---------- 7. section navigation ---------- */
  var FILTERS = [['all', 'All'], ['todo', 'Not final'], ['empty', 'No text'], ['open', 'Open items'], ['cmt', 'Comments'], ['off', 'Excluded']];
  function passes(p, s, r) {
    var q = (ui.secQ || '').toLowerCase().trim(), f = ui.secF || 'all';
    if (q && (s.code + ' ' + s.title).toLowerCase().indexOf(q) < 0) return false;
    if (f === 'todo') return s.on && (!s.body.trim() || s.status !== 'final');
    if (f === 'empty') return s.on && !s.body.trim();
    if (f === 'open') return s.on && r && r.flags > 0;
    if (f === 'cmt') return openCm(s).length > 0;
    if (f === 'off') return !s.on;
    return true;
  }
  listHtml = function (p) {
    var h = '', last = '', n = 0, q = (ui.secQ || '').trim(), col = ui.collapsed = ui.collapsed || {};
    p.sections.forEach(function (s) {
      var r = s.body.trim() ? renderSec(p, s) : null; if (!passes(p, s, r)) return; n++;
      var d = SS.divOf(s.code), shut = col[d] && !q;
      if (d !== last) { h += '<div class="div" data-act="divtog" data-d="' + d + '" style="cursor:pointer" title="Click to fold">' + (shut ? '▸ ' : '▾ ') + 'Div ' + d + ' – ' + esc(SS.DIVISIONS[d] || '') + '</div>'; last = d; }
      if (shut) return;
      var badge;
      if (!r) badge = '<span class="badge n">no text</span>';
      else badge = r.unresolved ? '<span class="badge r" title="Open questions or blanks to resolve">' + r.unresolved + ' open</span>' : (r.refMissing || []).length ? '<span class="badge r" title="Refers to a section that is not in this project">ref issue</span>' : s.status === 'final' ? '<span class="badge g">final</span>' : s.status === 'review' ? '<span class="badge b">review</span>' : '<span class="badge g">✓</span>';
      var nc = openCm(s).length;
      h += '<div class="sec ' + (s.code === ui.code ? 'on ' : '') + (s.on ? '' : 'off') + '" data-act="selsec" data-code="' + s.code + '"><input type="checkbox" data-act="toggle" data-code="' + s.code + '" ' + (s.on ? 'checked' : '') + ' title="Include in manual"><span class="c">' + s.code + '</span><span class="t">' + esc(s.title) + '</span>' + (nc ? '<span class="badge r" title="Open comments">💬 ' + nc + '</span>' : '') + badge + '</div>';
    });
    return h || '<div class="empty small">' + (p.sections.length ? 'No sections match this filter.' : 'No sections yet. Use “+ Add” to pick from the catalog.') + '</div>';
  };
  function secBar() {
    return '<div style="padding:6px 8px"><input type="text" data-secq placeholder="Filter sections…" value="' + esc(ui.secQ || '') + '" style="width:100%;padding:5px 8px;border:1px solid var(--border2);border-radius:6px"><div class="row" style="gap:4px;margin-top:5px;flex-wrap:wrap">' + FILTERS.map(function (f) { return '<button class="btn sm' + ((ui.secF || 'all') === f[0] ? ' pri' : '') + '" data-act="secf" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div></div>';
  }
  function stepSec(p, dir) {
    var l = p.sections.filter(function (s) { return passes(p, s, s.body.trim() ? renderSec(p, s) : null); }), i = -1;
    l.forEach(function (s, k) { if (s.code === ui.code) i = k; });
    var t = l[i < 0 ? 0 : Math.max(0, Math.min(l.length - 1, i + dir))]; if (!t) return;
    ui.tab = 'sections'; ui.code = t.code; ui.editText = false; render();
    setTimeout(function () { var e = document.querySelector('#seclist .sec.on'); if (e && e.scrollIntoView) e.scrollIntoView({ block: 'nearest' }); }, 20);
  }
  var vs0 = viewSections;
  viewSections = function (p) {
    var h = vs0(p), s = secOf(p);
    h = h.replace('<div id="seclist">', secBar() + '<div id="seclist">');
    h = h.replace('<div class="sp"></div><select data-act="status"', '<button class="btn sm" data-act="secprev" title="Previous section (Alt+↑)">↑</button><button class="btn sm" data-act="secnext" title="Next section (Alt+↓)">↓</button><div class="sp"></div><select data-act="status"');
    if (s) h = h.replace('<div class="panel"><div class="fld" style="margin:0"><label>Notes for this section', cmtPanel(s) + '<div class="panel"><div class="fld" style="margin:0"><label>Notes for this section');
    return h;
  };

  /* ---------- 11. restore points ---------- */
  function addRestore(p, name) {
    p.snaps = p.snaps || [];
    p.snaps.unshift({ id: SS.uid(), name: name, at: Date.now(), secs: clone(p.sections).map(function (s) { s.hist = []; return s; }) });
    if (p.snaps.length > 5) p.snaps.length = 5;
  }
  function restorePanel(p) {
    var l = p.snaps || [];
    return '<div class="panel"><div class="row"><h2 style="margin:0">Restore points</h2><div class="sp"></div><button class="btn sm" data-act="rpsave">Save a restore point</button></div><div class="small muted" style="margin:6px 0">A full copy of every section as it is right now. Keeps the latest five. Restoring first saves the current state, so you can switch back.</div>' +
      (l.length ? l.map(function (x) { return '<div class="row" style="padding:5px 0;border-top:1px solid var(--line2)"><span style="flex:1"><b>' + esc(x.name) + '</b> <span class="small muted">' + agoT(x.at) + ' • ' + x.secs.length + ' sections</span></span><button class="btn sm" data-act="rprestore" data-id="' + x.id + '">Restore</button><button class="btn sm" data-act="rpdel" data-id="' + x.id + '">×</button></div>'; }).join('') : '<div class="small muted">None saved yet.</div>') + '</div>';
  }

  /* ---------- 8. export presets ---------- */
  var BUILTIN = [{ name: 'Review set (with notes to specifier)', notes: true, cover: true }, { name: 'Issue set (clean)', notes: false, cover: true }, { name: 'Pages only (no cover or contents)', notes: false, cover: false }];
  function presets() { return BUILTIN.concat(settings.presets || []); }
  function presetByName(n) { return presets().filter(function (x) { return x.name === n; })[0] || BUILTIN[1]; }
  function presetOpts(sel) { return presets().map(function (x) { return '<option' + (x.name === sel ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join(''); }
  function presetPanel() {
    return '<div class="panel"><h2>Export presets</h2><div class="small muted">A preset sets whether notes to specifier and the cover and contents pages are included.</div><div class="row" style="margin-top:8px"><select id="presetsel">' + presetOpts(ui.preset || BUILTIN[1].name) + '</select><button class="btn pri" data-act="presetword">Word</button><button class="btn" data-act="presetpdf">PDF</button><button class="btn sm" data-act="presetsave">Save current options as a preset</button><button class="btn sm" data-act="presetdel">Delete preset</button></div><div class="row small" style="margin-top:8px"><label><input type="checkbox" data-act="optCover"' + (ui.cover !== false ? ' checked' : '') + '> include cover page and table of contents</label></div></div>';
  }
  function applyPreset(n) { var pr = presetByName(n); ui.notes = !!pr.notes; ui.cover = pr.cover !== false; }

  /* ---------- 9. guided issue ---------- */
  var gi = { step: 1 };
  function giRead() {
    var g = function (id) { var e = $(id); return e; };
    if (g('#giforce')) gi.force = g('#giforce').checked;
    if (g('#gi-name')) { gi.name = g('#gi-name').value.trim(); gi.date = g('#gi-date').value.trim(); gi.note = g('#gi-note').value.trim(); gi.set = g('#gi-set').checked; gi.preset = g('#gi-preset').value; }
    if (g('#gi-word')) { gi.word = g('#gi-word').checked; gi.pdf = g('#gi-pdf').checked; }
  }
  function giModal() {
    var p = proj(), c = issueCheck(p), b;
    if (gi.step === 1) {
      b = '<div class="small muted" style="margin-bottom:6px">Step 1 of 3 – Check the set</div>' +
        (c.block.length ? c.block.slice(0, 8).map(function (x) { return '<div class="row" style="padding:3px 0"><a href="#" data-act="gigo" data-code="' + esc(x.code) + '" style="font-weight:600;width:64px;color:inherit">' + esc(x.code) + '</a><span style="flex:1">' + esc(x.text) + '</span></div>'; }).join('') + (c.block.length > 8 ? '<div class="small muted">…and ' + (c.block.length - 8) + ' more (see Issue / export)</div>' : '') + '<label class="small" style="display:block;margin-top:10px"><input type="checkbox" id="giforce"' + (gi.force ? ' checked' : '') + '> Issue anyway with these still open (they will print highlighted)</label>' : '<div><span class="badge g">Nothing blocking</span></div>') +
        (c.warn.length ? '<div class="small muted" style="margin-top:8px">' + c.warn.length + ' item' + (c.warn.length > 1 ? 's' : '') + ' to review, such as statuses and comments. These do not block issuing.</div>' : '');
    } else if (gi.step === 2) {
      b = '<div class="small muted" style="margin-bottom:6px">Step 2 of 3 – Name this issue</div><div class="two"><div class="fld"><label>Issue name</label><input type="text" id="gi-name" value="' + esc(gi.name || p.phase || '') + '" placeholder="Permit Set"></div><div class="fld"><label>Issue date</label><input type="text" id="gi-date" value="' + esc(gi.date || todayStr()) + '"></div></div><div class="fld"><label>Note (what changed, who it went to)</label><input type="text" id="gi-note" value="' + esc(gi.note || '') + '"></div>' +
        '<label class="small" style="display:block"><input type="checkbox" id="gi-set"' + (gi.set === false ? '' : ' checked') + '> Use this name and date on the cover page</label><div class="fld" style="margin-top:8px"><label>Output style</label><select id="gi-preset">' + presetOpts(gi.preset || BUILTIN[1].name) + '</select></div>';
    } else {
      b = '<div class="small muted" style="margin-bottom:6px">Step 3 of 3 – Freeze and export</div><div class="small" style="line-height:1.7">Issue: <b>' + esc(gi.name) + '</b> • ' + esc(gi.date) + '<br>Style: <b>' + esc(gi.preset) + '</b></div><div style="margin:10px 0"><label class="small" style="display:block"><input type="checkbox" id="gi-word"' + (gi.word === false ? '' : ' checked') + '> Word (.docx)</label><label class="small" style="display:block"><input type="checkbox" id="gi-pdf"' + (gi.pdf ? ' checked' : '') + '> PDF (opens the print dialog)</label></div><div class="small muted">Freezing records this issue so later changes can be compared, and saves a restore point. To add AIA documents or consultant sections to a PDF, use Merge on the Issue / export tab afterwards.</div>';
    }
    modal('<h2>Issue the manual</h2>' + b + '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button>' + (gi.step > 1 ? '<button class="btn" data-act="giback">Back</button>' : '') + (gi.step < 3 ? '<button class="btn pri" data-act="ginext">Next</button>' : '<button class="btn pri" data-act="gigo2">Freeze &amp; export</button>') + '</div>', true);
  }
  function giFinish() {
    giRead(); var p = proj(); if (!gi.word && !gi.pdf) { if (!confirm('No output is ticked. Freeze this issue without exporting?')) return; }
    p.issues = p.issues || []; p.issues.push({ id: SS.uid(), name: gi.name, date: gi.date, note: gi.note || '', at: Date.now(), secs: snapshot(p) });
    if (gi.set !== false) { p.phase = gi.name; p.issueDate = gi.date; }
    addRestore(p, 'Issued: ' + gi.name); saveProjects(); closeModal(); applyPreset(gi.preset); render();
    if (gi.word) exportDocx(p, 'all'); if (gi.pdf) exportPdf(p, 'all');
    toast('Issued: ' + gi.name, 5000);
  }

  /* ---------- 10. help ---------- */
  var HELP = {
    overview: ['Overview', 'Your starting point. It lists what is left to do, with a button that takes you straight to each item. Start at the top and work down.'],
    sections: ['Sections', 'Pick a section on the left. Answer its questions, or press ✨ Fill answers from notes. Use the filter and chips to find sections that are not final, have no text, or have open items. ↑ ↓ (or Alt+↑ / Alt+↓) move between sections. Undo and History bring back earlier text. Comments are for you and never print.'],
    info: ['Project info & notes', 'Fill in the project name, owner, code and team. These fill in across every section and the cover page. Paste design notes at the bottom so AI can answer section questions for you.'],
    sources: ['Sources', 'Drop finish schedules, hardware sets and drawings here. AI reads them to fill answers and check sections against the drawings.'],
    products: ['Products', 'Upload a cut sheet and Slate writes a product spec section from it.'],
    consultants: ['Consultants', 'Drop in specification PDFs from engineers. They are not sent to AI or sorted. They go into the manual and table of contents when you merge.'],
    submittals: ['Submittals', 'A register built from your sections. Set a status for each line and download it as CSV for Excel.'],
    coord: ['Coordination', 'Conflicts and gaps found when sections are checked against each other and against the drawings. Mark them done as you resolve them.'],
    export: ['Issue / export', 'Run the pre-issue check, freeze an issue, apply modifications, merge AIA documents and consultant sections, and export. Use Start guided issue for the usual path.'],
    projects: ['Projects', 'Each card is a project manual. Use + New project, or Duplicate on a finished project to start the next one from it.'],
    library: ['Library', 'The ai3 master boilerplate. Edit a master once and projects can pull the update.'],
    settings: ['Settings', 'API key, firm profile, project types, backup and cloud sync.']
  };
  function helpModal() {
    var k = ui.view === 'project' ? ui.tab : ui.view, h = HELP[k] || HELP.projects;
    modal('<h2>Help – ' + esc(h[0]) + '</h2><div style="line-height:1.6">' + esc(h[1]) + '</div><h3 style="margin-top:16px">Shortcuts</h3><div class="small" style="line-height:1.9"><b>Ctrl/Cmd+K</b> or <b>/</b> – find in this project<br><b>Alt+↑ / Alt+↓</b> – previous or next section<br><b>?</b> – this help</div><div class="mfoot"><button class="btn pri" data-act="helpfull">Open full Help</button><button class="btn" data-act="closemodal">Close</button></div>', true);
  }
  function tipsPanel() {
    if (localStorage.getItem('ss1_tipsoff')) return '';
    return '<div class="panel"><div class="row"><h2 style="margin:0">Getting started</h2><div class="sp"></div><button class="btn sm" data-act="helpopen">Help</button><button class="btn sm" data-act="tipsoff">Hide</button></div><ol class="small" style="line-height:1.8;margin:8px 0 0 18px"><li>Fill in <b>Project info</b> (name, owner, code, team).</li><li>On <b>Sections</b>, use ✨ Fill gaps for any section with no text.</li><li>Answer each section’s questions, or paste notes and press ✨ Fill from notes.</li><li>Clear the open items here, then use <b>Start guided issue</b>.</li></ol></div>';
  }

  /* ---------- 12. backup reminder ---------- */
  var db0 = downloadBackup;
  downloadBackup = function (n) { db0(n); try { localStorage.setItem('ss1_lastbackup', String(Date.now())); localStorage.removeItem('ss1_bksnooze'); } catch (e) {} };
  try { if (!localStorage.getItem('ss1_lastbackup')) localStorage.setItem('ss1_lastbackup', String(Date.now())); } catch (e) {}
  function bkBanner() {
    if (!projects.length) return '';
    var last = +localStorage.getItem('ss1_lastbackup') || 0, sn = +localStorage.getItem('ss1_bksnooze') || 0, lim = (cloud && cloud.user ? 30 : 7) * DAY;
    if (Date.now() - last < lim || Date.now() < sn) return '';
    var d = Math.round((Date.now() - last) / DAY);
    return '<div class="panel" style="border-color:var(--amber,#d9a400)"><div class="row"><span style="flex:1"><b>Back up your work.</b> The last backup was ' + d + ' day' + (d === 1 ? '' : 's') + ' ago. A backup is one file with every project and your library.</span><button class="btn sm pri" data-act="backup">Download backup</button><button class="btn sm" data-act="bksnooze">Remind me in 3 days</button></div></div>';
  }

  /* ---------- 13. firm profile ---------- */
  var FIRM = [['name', 'Firm name', 'ai3, Inc.'], ['address', 'Firm address (printed under the architect on the cover)', '1000 Peachtree St, Atlanta, GA'], ['phone', 'Phone', ''], ['web', 'Website', ''], ['reg', 'Registration or license note', ''], ['defCode', 'Default governing building code', ''], ['defContract', 'Default contract form', 'AIA A201-2017'], ['numLabel', 'Cover label for project numbers', 'ai3 Project No.'], ['userName', 'Your name (shown on comments)', '']];
  function firmPanel() {
    var f = settings.firm || {};
    return '<div class="panel"><h2>Firm profile</h2><div class="small muted" style="margin-bottom:8px">Used to prefill new projects and to print the architect’s address on the cover page.</div><div class="two">' + FIRM.map(function (x) { return '<div class="fld"><label>' + x[1] + '</label><input type="text" id="fm-' + x[0] + '" value="' + esc(f[x[0]] || '') + '" placeholder="' + esc(x[2]) + '"></div>'; }).join('') + '</div><button class="btn" data-act="firmsave">Save firm profile</button></div>';
  }
  var vset0 = viewSettings;
  viewSettings = function () {
    var h = vset0(), last = +localStorage.getItem('ss1_lastbackup') || 0;
    h = h.replace('<div class="panel"><h2>Cloud &amp; backup</h2>', firmPanel() + '<div class="panel"><h2>Cloud &amp; backup</h2><div class="small muted" style="margin-bottom:6px">Last backup downloaded: ' + (last ? agoT(last) : 'never') + '</div>');
    return h;
  };

  /* ---------- wrappers for existing views ---------- */
  var ov0 = window.viewOverview;
  window.viewOverview = function (p) {
    var h = ov0(p), cm = [], n = 0;
    p.sections.forEach(function (s) { if (s.on && openCm(s).length) { n += openCm(s).length; cm.push(s); } });
    h = h.replace('<div class="panel"><div class="row" style="gap:10px', bkBanner() + tipsPanel() + '<div class="panel"><div class="row" style="gap:10px');
    if (n) h = h.replace('<div class="panel"><h2>What to do next</h2>', '<div class="panel"><h2>What to do next</h2><div class="row" style="padding:8px 0;border-bottom:1px solid var(--line2)"><span style="flex:1"><b>' + n + '</b> open comment' + (n > 1 ? 's' : '') + ' in ' + cm.length + ' section' + (cm.length > 1 ? 's' : '') + '.</span><button class="btn sm" data-act="ovgo" data-go="sec:' + cm[0].code + '">Open first</button></div>');
    h = h.replace('<div class="panel"><h2>At a glance</h2>', '<div class="panel"><div class="row"><span style="flex:1"><b>Ready to send the set out?</b> The guided issue checks, names the issue, freezes it and exports.</span><button class="btn pri" data-act="giopen">Start guided issue</button></div></div>' + restorePanel(p) + '<div class="panel"><h2>At a glance</h2>');
    return h;
  };
  var vp0 = viewProjects;
  viewProjects = function () { return vp0().replace(/(<button class="btn pri" data-act="newproj">\+ New project<\/button><\/div>)/, '<button class="btn" data-act="helpopen">Help</button>$1').replace('<div class="grid">', bkBanner() + '<div class="grid">'); };
  var ve0 = viewExport;
  viewExport = function (p) { return ve0(p).replace('<div class="wrap">', '<div class="wrap"><div class="panel"><div class="row"><span style="flex:1"><b>Guided issue.</b> Check, name, freeze and export in three steps.</span><button class="btn pri" data-act="giopen">Start guided issue</button></div></div>' + presetPanel() + restorePanel(p)); };
  var vpj0 = viewProject;
  viewProject = function () { return vpj0().replace('<button class="btn sm" data-act="findopen"', '<button class="btn sm" data-act="helpopen" title="Help for this tab (?)">Help</button><button class="btn sm" data-act="findopen"'); };

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act, p = proj(), s = p && secOf(p);
    if (act === 'cmtadd') { var t = ($('#cmtnew').value || '').trim(); if (!t || !s) return; (s.cmts = s.cmts || []).push({ text: t, by: (settings.firm || {}).userName || '', at: Date.now(), done: false }); saveProjects(); render(); setTimeout(function () { var i = $('#cmtnew'); if (i) i.focus(); }, 30); }
    else if (act === 'cmttog' && s) { var c = s.cmts[+el.dataset.i]; if (c) { c.done = !c.done; saveProjects(); render(); } }
    else if (act === 'cmtdel' && s) { s.cmts.splice(+el.dataset.i, 1); saveProjects(); render(); }
    else if (act === 'secf') { ui.secF = el.dataset.f; render(); }
    else if (act === 'divtog') { var d = el.dataset.d; ui.collapsed = ui.collapsed || {}; ui.collapsed[d] = !ui.collapsed[d]; var l = $('#seclist'); if (l) l.innerHTML = listHtml(p); }
    else if (act === 'secprev') stepSec(p, -1);
    else if (act === 'secnext') stepSec(p, 1);
    else if (act === 'rpsave') { var nm = prompt('Name this restore point', 'Restore point ' + new Date().toLocaleDateString()); if (nm === null) return; addRestore(p, (nm || '').trim() || 'Restore point'); saveProjects(); render(); toast('Restore point saved'); }
    else if (act === 'rprestore') { var sn = (p.snaps || []).filter(function (x) { return x.id === el.dataset.id; })[0]; if (!sn || !confirm('Restore “' + sn.name + '”? Your current sections are saved as a restore point first.')) return; var secs = clone(sn.secs); addRestore(p, 'Before restoring “' + sn.name + '”'); p.sections = secs; saveProjects(); render(); toast('Restored', 4000); }
    else if (act === 'rpdel') { p.snaps = (p.snaps || []).filter(function (x) { return x.id !== el.dataset.id; }); saveProjects(); render(); }
    else if (act === 'presetword' || act === 'presetpdf') { ui.preset = $('#presetsel').value; applyPreset(ui.preset); render(); if (act === 'presetword') exportDocx(p, 'all'); else exportPdf(p, 'all'); }
    else if (act === 'presetsave') { var pn = prompt('Name this preset', 'My preset'); if (!pn || !pn.trim()) return; pn = pn.trim(); if (BUILTIN.some(function (x) { return x.name === pn; })) return toast('That name is built in. Choose another.'); settings.presets = (settings.presets || []).filter(function (x) { return x.name !== pn; }); settings.presets.push({ name: pn, notes: !!ui.notes, cover: ui.cover !== false }); saveSettings(); ui.preset = pn; render(); toast('Preset saved'); }
    else if (act === 'presetdel') { var pd = $('#presetsel').value; if (BUILTIN.some(function (x) { return x.name === pd; })) return toast('Built-in presets cannot be deleted.'); settings.presets = (settings.presets || []).filter(function (x) { return x.name !== pd; }); saveSettings(); ui.preset = ''; render(); }
    else if (act === 'giopen') { gi = { step: 1 }; giModal(); }
    else if (act === 'ginext') { giRead(); if (gi.step === 1 && issueCheck(p).block.length && !gi.force) return toast('Fix the open items, or tick “Issue anyway”.'); if (gi.step === 2 && !gi.name) return toast('Give the issue a name.'); gi.step++; giModal(); }
    else if (act === 'giback') { giRead(); gi.step--; giModal(); }
    else if (act === 'gigo') { e.preventDefault(); closeModal(); ui.tab = 'sections'; ui.code = el.dataset.code; render(); }
    else if (act === 'gigo2') giFinish();
    else if (act === 'helpopen') helpModal();
    else if (act === 'tipsoff') { localStorage.setItem('ss1_tipsoff', '1'); render(); }
    else if (act === 'bksnooze') { localStorage.setItem('ss1_bksnooze', String(Date.now() + 3 * DAY)); render(); }
    else if (act === 'backup') setTimeout(render, 50);
    else if (act === 'firmsave') { var f = {}; FIRM.forEach(function (x) { f[x[0]] = ($('#fm-' + x[0]).value || '').trim(); }); settings.firm = f; if (f.name) settings.architect = f.name; saveSettings(); toast('Firm profile saved'); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.dataset && t.dataset.act === 'optCover') ui.cover = t.checked;
    if (t.id === 'presetsel') ui.preset = t.value;
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (t && t.dataset && t.dataset.secq !== undefined) { ui.secQ = t.value; var p = proj(), l = $('#seclist'); if (p && l) l.innerHTML = listHtml(p); }
  });
  document.addEventListener('keydown', function (e) {
    var tg = e.target || {}, typing = /INPUT|TEXTAREA|SELECT/.test(tg.tagName || '') || tg.isContentEditable;
    if (e.key === 'Enter' && tg.id === 'cmtnew') { e.preventDefault(); var b = document.querySelector('[data-act=cmtadd]'); if (b) b.click(); }
    else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && ui.view === 'project' && ui.tab === 'sections') { e.preventDefault(); stepSec(proj(), e.key === 'ArrowDown' ? 1 : -1); }
    else if (e.key === '?' && !typing && !document.getElementById('modal')) { e.preventDefault(); helpModal(); }
  });
})();

/* ================= HELP CENTER ================= */
(function () {
  var P = [
    ['quick', 'First project in 10 minutes', '<p>This is the shortest path from nothing to an issued manual.</p><ol><li><b>Create the project.</b> On <b>Projects</b>, press <b>+ New project</b>. Step 1 asks for the name, number, type, owner, address and phase. Step 2 asks for the building code, contract form and the design team. Step 3 picks the starting set of sections. Choosing a project type (hotel, restaurant, office, residential) preselects the set that fits it.</li><li><b>Open Sections.</b> Every included section is listed on the left. Sections with no text show a “no text” badge.</li><li><b>Fill the gaps.</b> Press <b>✨ Fill gaps</b> to write boilerplate for every included section that has none. Slate uses the ai3 master text from the library first and only asks AI to draft what the library lacks.</li><li><b>Answer the questions.</b> Click a section. Its project-specific questions are in the middle column. Answer them yourself, or paste design notes on <b>Project info &amp; notes</b> and press <b>✨ Apply notes &amp; uploads to all sections</b>.</li><li><b>Clear the open items.</b> Go to <b>Overview</b>. The “What to do next” list shows what is left, with a button for each item.</li><li><b>Issue it.</b> When Overview says everything is complete, press <b>Start guided issue</b>. It checks the set, names the issue, freezes it, and exports Word and/or PDF.</li></ol><p class="small muted">Tip: you do not need to finish every step before looking at the result. The preview on the right of the Sections tab shows the section as it will print.</p>'],
    ['how', 'How Slate works', '<p>Slate keeps three layers apart so edits never collide.</p><ul><li><b>The master library</b> holds ai3’s standard text for each section. Editing a master changes future projects only.</li><li><b>Each project</b> holds its own copy of every section. Changing a project section never touches the library unless you press <b>Save to library as ai3 standard</b>.</li><li><b>Answers</b> are the project-specific facts (board thickness, manufacturer, locations). The section text uses them as <code>{{variables}}</code>, and some paragraphs appear only when an answer calls for them.</li></ul><h3>What the marks mean</h3><ul><li><b>Yellow highlight on screen and in exports</b>: an unanswered question or anything left in [square brackets]. Nothing leaves the building unmarked.</li><li><b>Status</b> on each section: Draft, In review, Final. The Overview counts these.</li><li><b>Notes to specifier</b> appear only in review sets, never in an issue set.</li></ul><h3>Section text format</h3><p>Each line is one paragraph. <code># GENERAL</code> is a Part, <code>## SUMMARY</code> is an Article. <code>1:</code> to <code>4:</code> set the paragraph level (A., 1., a., 1)). <code>N:</code> is a note to specifier. <code>?(key=Value)</code> makes a line conditional on an answer. Part and Article numbers are added for you. The cheat sheet is on the section text editor in the library.</p>'],
    ['projects', 'Projects, types and starting points', '<h3>Project types</h3><p>Hotel, restaurant, office and residential projects need different sections. Each type has its own section set, which you can change under <b>Settings → Project types</b>. Slate can also learn a set from your past projects.</p><h3>New project</h3><p><b>+ New project</b> runs a three-step wizard. Everything can be changed later on <b>Project info &amp; notes</b>. Defaults for the building code, contract form and architect come from your <b>Firm profile</b> in Settings.</p><h3>Duplicate</h3><p>Use <b>Duplicate</b> on a project card or in the project header to start the next project from a finished one. You choose whether to copy the section text and answers as they are, or only the list of sections with fresh master text. The project number, owner, address, issue date, issue history and notes are never copied. You can also keep the building code, the design team and the consultant specifications.</p><h3>Import a finished manual as a project</h3><p>If the specifications are already written, press <b>Import a manual…</b> on the Projects page. Drop the PDF or Word file, or select all of the manual’s Word files at once when each section is its own file. A file named like “Table of Contents” or “Cover” is used for the project details and is not imported as a section. Slate reads the project details from the cover and splits the manual into sections, keeping your text exactly as written. You review the details and tick the sections to bring in, then press <b>Create project</b>. The cover page and table of contents are rebuilt by Slate. Consultant specifications and attachments are not read as sections: add them on the Consultants tab. Then add your finish schedules on Sources, clear the open items on Overview, and issue it.</p><h3>Add more sections from files later</h3><p>In any project, press <b>Import sections from files…</b> at the top of the section list. Select the Word or PDF files for the sections you want to add. Slate keeps your text as written. Sections that are new are ticked. Sections already in the project are left unticked: tick one to replace its text, and the old text stays in that section’s History.</p><h3>Reuse</h3><p>On <b>Sections</b>, <b>Reuse</b> copies chosen sections from another project, with or without their answers.</p><h3>Bulk import</h3><p>On <b>Reference projects</b>, <b>Bulk import</b> reads many past project manuals (PDF or Word) at once and files each into your reference archive, tagged by project type. Slate then uses them when it drafts new sections. Files that are already in the archive are skipped.</p>'],
    ['sections', 'Working in the Sections tab', '<h3>The three columns</h3><p><b>Left:</b> the section list. <b>Middle:</b> the selected section’s status, tools, questions and notes. <b>Right:</b> a live preview of how the section prints.</p><h3>Cover page and table of contents</h3><p>At the top of the section list are <b>Cover page</b> and <b>Table of contents</b>. Click either to see exactly how it will print, with real page counts. The middle column shows which fields feed it and where to change them. <b>Refresh preview</b> rebuilds it after you make changes.</p><h3>Finding your way</h3><ul><li>Type in the filter box to narrow the list by number or title.</li><li>The chips show sections that are <b>Not final</b>, have <b>No text</b>, have <b>Open items</b>, have <b>Comments</b>, or are <b>Excluded</b>.</li><li>Click a division heading to fold it.</li><li><b>↑ ↓</b> in the section header, or <b>Alt+↑ / Alt+↓</b>, move to the previous or next section in the filtered list.</li><li><b>Ctrl/Cmd+K</b> or <b>/</b> searches the text of every section, plus consultant specifications and products.</li></ul><h3>Adding and removing</h3><p>The checkbox next to a section includes it in the manual. <b>+ Add</b> opens the catalog of CSI sections. To change a section’s number, use <b>Renumber</b> in its header. References to it in other sections follow.</p><h3>Writing</h3><ul><li><b>✨ Generate boilerplate with AI</b> drafts a section that has no text.</li><li><b>✨ Fill answers from notes &amp; uploads</b> answers the section’s questions from your project notes and uploaded documents. AI-filled answers carry an AI badge so you can check them.</li><li><b>✨ AI review</b> reads the section and lists problems.</li><li><b>Edit section text</b> opens the raw text for direct editing.</li><li><b>Insert manufacturers</b> and <b>Build References</b> add those articles from what the section already cites.</li><li><b>Reference</b> shows how your past project manuals handled the same section.</li></ul><h3>Undo, history, comments</h3><p><b>↶ Undo</b> puts back the text from before the last change. <b>History</b> lists the last six versions, with a compare view and a Restore button. Slate saves a version before AI rewrites, library pulls, imports and larger edits. <b>Comments &amp; flags</b> are private notes for you and your team. They never print. They appear in the pre-issue check until you mark them resolved.</p><h3>Library updates</h3><p>When the master has a newer revision, the section shows <b>Library updated — pull latest</b> and <b>Review changes</b>, which shows exactly what would change.</p>'],
    ['sources', 'Notes, uploads and AI', '<h3>API key</h3><p>AI features need an Anthropic API key. Paste it under <b>Settings → AI</b>. It is stored only in this browser. Nothing else is sent anywhere except the text AI needs for the task you started.</p><h3>Project notes</h3><p>On <b>Project info &amp; notes</b>, paste the design narrative, meeting notes or owner program. AI uses it to answer each section’s questions. It fills blanks only and marks what it filled.</p><h3>Sources tab</h3><p>Drop finish schedules, door hardware sets and drawings here. Slate reads them and extracts finishes, hardware sets, wall types, code information, a sheet index and notes that affect specs. Sections can then be checked against them: <b>✨ Check vs drawings &amp; finishes</b> lists conflicts and gaps, which show up on the Coordination tab.</p><h3>What AI will not do</h3><p>It does not overwrite your text silently. It fills blanks, drafts empty sections, or proposes changes that you accept. Consultant specifications and merged PDFs are never sent to AI.</p>'],
    ['products', 'Writing a spec from a cut sheet', '<p>The <b>Products</b> tab turns a manufacturer cut sheet into a specification section.</p><ol><li>Drop the cut sheet (PDF or Word) onto the drop zone.</li><li>Slate shows <b>What the cut sheet says</b>: manufacturer, product, key properties, standards, options.</li><li>Choose the section number or let Slate suggest one.</li><li>It drafts the section using ai3’s section format, based only on the cut sheet. Anything it could not find is left in [brackets] for you to resolve.</li><li>Review the draft and apply it. <b>Undo</b> restores the previous state.</li></ol><p>The product is listed under <b>Products specified in this project</b>.</p>'],
    ['mods', 'Modifications and addenda', '<p>Use a modification when an addendum, bulletin or change order replaces specification sections.</p><ol><li>On <b>Issue / export</b>, find <b>Modifications</b>. Upload the change document (Word or PDF).</li><li>Slate reads it and separates the sections it contains into <b>replaced</b> (a section already in the project) and <b>new</b>.</li><li>Press <b>Compare</b> on any row to see the old text against the new, line by line.</li><li>Tick the sections you want and press <b>Apply</b>. Whole sections are replaced and new sections are added.</li><li><b>Undo</b> on the same panel puts everything back exactly as it was.</li></ol><p>Modifications replace whole sections, not paragraphs. For issuing addenda to the team, freeze an issue first so <b>Compare issues</b> can list what changed.</p><h3>Import edits from Word</h3><p>If someone edited an exported Word file, <b>Import edits from Word</b> on the Issue / export tab reads their changes and lets you accept them section by section.</p>'],
    ['consult', 'Consultant specs and merging documents', '<h3>Consultant specifications</h3><p>The <b>Consultants</b> tab holds specification PDFs from your engineers. Drop each file, choose its discipline and division, and give it a title and number. Slate does not send these to AI or sort them. They are added to the manual and the table of contents when you merge. Use the arrows to set the order.</p><h3>Merge documents into the PDF</h3><p>On <b>Issue / export</b>, <b>Merge documents into the PDF</b> builds the final combined PDF. It asks you what you are merging:</p><ul><li>the exported Slate manual (PDF)</li><li>licensed documents such as the AIA A201 General Conditions or the owner’s agreement</li><li>appendices or other PDFs</li><li>consultant specifications from the Consultants tab</li></ul><p><b>Save the AIA forms once.</b> Under <b>Settings → Standard documents</b>, drop in your licensed A201 General Conditions, A101 and other forms. You can give each a name for the bookmark, paste a link to where it comes from, and tick <b>Add by default</b>. When you merge, a box lists them and ticks any that match the project’s contract form (for example A201). Press <b>Add checked documents</b>. These files stay in this browser on this computer, are never sent to AI, and are not part of sync or backup, so keep your originals.</p><p>For each file you choose where it goes: before or after a section, at the front, or at the end. Slate adds bookmarks for everything it merges, keeps your originals untouched, and the table of contents shows the consultant specifications with their page counts.</p><p class="small muted">Why export the PDF first: merging works on the finished PDF so page numbers are final.</p>'],
    ['subs', 'Submittals and coordination', '<h3>Submittals</h3><p>The register is built from the Submittals, Warranty, Mock-up and Closeout articles of every included section. It updates as the specs change. Set a status on each line (Not started to Closed). <b>Download CSV</b> opens in Excel; <b>Copy</b> puts the CSV text on the clipboard.</p><h3>Coordination</h3><p>Findings from checking sections against drawings and finishes, and against each other. Each has a severity: <b>conflict</b> (blocks issuing), <b>gap</b> (review) or note. Mark items done as you resolve them. They appear in the pre-issue check.</p>'],
    ['issue', 'Issuing, presets and restore points', '<h3>Pre-issue check</h3><p>Lists what must be fixed before issuing (sections with no text, unanswered questions, brackets, coordination conflicts) and what to review (status not Final, newer library revisions, open comments, references to sections not in the project).</p><h3>Guided issue</h3><p><b>Start guided issue</b> on Overview or Issue / export walks through three steps: check the set, name the issue and date, then freeze and export Word and/or PDF. You can issue with open items if you tick <b>Issue anyway</b>; they print highlighted.</p><h3>Frozen issues</h3><p>Freezing records the exact text of every section. Later you can use <b>Compare issues</b> to see what changed between two issues, copy an addendum summary, or print it. Issue dates by section appear on the table of contents.</p><h3>Export presets</h3><p>A preset sets whether notes to specifier and the cover and contents pages print. Built in: <b>Review set</b>, <b>Issue set (clean)</b> and <b>Pages only</b>. Set the options you want, then <b>Save current options as a preset</b>. Presets are stored in this browser.</p><h3>Word and PDF</h3><p>Word files are complete and editable, with a cover page, table of contents, headers and footers. PDF uses your browser’s print dialog: choose <b>Save as PDF</b>, and turn off headers and footers in the print options.</p><h3>Restore points</h3><p>A restore point is a full copy of every section. Save one before a risky change. Slate keeps the latest five and saves one automatically each time you issue. Restoring first saves your current state.</p>'],
    ['library', 'Master library and reference projects', '<h3>Master library</h3><p>Your standard text for each section. Every edit raises the revision so projects can pull updates. Statuses run Starter, AI draft, Reviewed, ai3 standard. Each master keeps its history, with compare and restore. <b>Import from manual</b> reads a finished manual and files its sections as masters.</p><h3>Reference projects</h3><p>A private archive of past manuals, searchable from any section with <b>Reference</b>. Import one at a time or in bulk, and tag each with a project type. Slate uses them to draft sections that match how ai3 writes.</p>'],
    ['settings', 'Settings, firm profile and backup', '<h3>Firm profile</h3><p>Firm name, address, phone, website, registration note, default building code, default contract form, the cover label for project numbers, and your name for comments. New projects start with these, and the firm address prints under the architect on the cover page.</p><h3>Standard documents</h3><p>Save licensed PDFs such as the AIA General Conditions once, so they are ready to merge into any project.</p><h3>Project types</h3><p>Edit the section set for each type, add a type, or let Slate learn a set from your reference projects.</p><h3>Cloud and backup</h3><p>Sign in to sync projects between computers. Sync saves the whole record each time, so the last save wins: do not edit the same project on two computers at once. <b>Download backup</b> saves one file with every project, your library, archive and settings. Slate reminds you after seven days without one (thirty if you are signed in). Consultant PDFs are stored on the computer where you added them and are not part of sync or backup, so keep your originals.</p>'],
    ['faq', 'Shortcuts and troubleshooting', '<h3>Shortcuts</h3><p><b>Ctrl/Cmd+K</b> or <b>/</b> find in project • <b>Alt+↑ / Alt+↓</b> previous or next section • <b>?</b> help for this tab</p><h3>Common questions</h3><p><b>AI buttons say there is no key.</b> Paste your Anthropic API key in Settings and press Save.</p><p><b>A section shows yellow text in the export.</b> It has an unanswered question or a [bracketed] decision. Open the section and resolve it.</p><p><b>I changed the library but my project did not change.</b> Projects keep their own copy. Open the section and press <b>Library updated — pull latest</b>.</p><p><b>My PDF has browser headers and footers.</b> In the print dialog, open More settings and turn off Headers and footers.</p><p><b>I made a mistake.</b> Try ↶ Undo or History on the section. For larger changes use a restore point, or <b>Undo</b> on a modification.</p><p><b>My work is on another computer.</b> Sign in to sync on both, or move it with a backup file.</p>']
  ];
  var MAP = { overview: 'quick', sections: 'sections', info: 'projects', sources: 'sources', products: 'products', consultants: 'consult', submittals: 'subs', coord: 'subs', export: 'issue', projects: 'projects', library: 'library', archive: 'library', settings: 'settings' };
  function plain(h) { return h.replace(/<[^>]+>/g, ' ').toLowerCase(); }
  window.viewHelp = function () {
    var q = (ui.hq || '').toLowerCase().trim(), words = q.split(/\s+/).filter(Boolean);
    var list = P.filter(function (x) { var t = (x[1] + ' ' + plain(x[2])); return words.every(function (w) { return t.indexOf(w) >= 0; }); });
    if (!ui.hp || !P.some(function (x) { return x[0] === ui.hp; })) ui.hp = 'quick';
    var cur = P.filter(function (x) { return x[0] === ui.hp; })[0];
    if (list.length && !list.some(function (x) { return x[0] === cur[0]; })) cur = list[0];
    var nav = list.map(function (x) { return '<button class="ni' + (x[0] === cur[0] ? ' on' : '') + '" data-act="helppage" data-k="' + x[0] + '" style="display:block;width:100%;text-align:left;padding:8px 10px">' + x[1] + '</button>'; }).join('') || '<div class="small muted" style="padding:8px">No pages match.</div>';
    return '<div class="wrap" style="max-width:1100px"><h1>Help</h1><div class="muted" style="margin-bottom:12px">How to use Slate Specs, from the first project to issuing the set.</div><div style="display:grid;grid-template-columns:260px 1fr;gap:16px"><div><input type="text" data-helpq placeholder="Search help…" value="' + esc(ui.hq || '') + '" style="width:100%;padding:7px 10px;border:1px solid var(--border2);border-radius:8px;margin-bottom:8px"><div class="panel" style="padding:4px" id="helpnav">' + nav + '</div></div><div class="panel" id="helpbody" style="line-height:1.6"><h2>' + cur[1] + '</h2>' + cur[2] + '</div></div></div>';
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act;
    if (act === 'helppage') { ui.hp = el.dataset.k; render(); var b = $('#main'); if (b) b.scrollTop = 0; }
    else if (act === 'helpfull') { closeModal(); ui.hp = MAP[ui.view === 'project' ? ui.tab : ui.view] || 'quick'; ui.hq = ''; ui.prevView = ui.view; ui.view = 'help'; render(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (t && t.dataset && t.dataset.helpq !== undefined) { ui.hq = t.value; var pos = t.selectionStart; render(); var i = document.querySelector('[data-helpq]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) {} } }
  });
})();

/* ================= COVER PAGE AND TABLE OF CONTENTS PREVIEW (Sections tab) ================= */
(function () {
  var seq = 0;
  function isFront() { return ui.code === '__cover' || ui.code === '__toc'; }
  function frontRow(k, label, note) { return '<div class="sec ' + (ui.code === k ? 'on' : '') + '" data-act="selpseudo" data-k="' + k + '"><span class="c">Front</span><span class="t">' + label + '</span><span class="badge n">' + note + '</span></div>'; }
  function val(v) { return v ? esc(v) : '<span class="muted">not filled in</span>'; }
  function midPanel(p) {
    var cover = ui.code === '__cover', f = settings.firm || {}, ex = expProject(p);
    if (cover) {
      var rows = [['Project name', p.name], ['Address', p.address], ['City, State', p.cityState], ['Project number', p.number], ['Issue name (phase)', p.phase], ['Issue date', p.issueDate], ['Owner', p.owner], ['Architect of record', ex.archLine || p.architect || settings.architect], ['Construction management', p.cm || p.contractor], ['MEP engineer', p.mep], ['Structural engineer', p.structural], ['Interior designer', p.interior]];
      return '<div class="panel"><div class="row"><b style="font-size:15px">Cover page</b><div class="sp"></div><button class="btn sm" data-act="frontrefresh">Refresh preview</button></div><div class="small muted" style="margin:6px 0 10px">The cover is built from these fields. Change them on Project info and the preview updates when you come back. People left blank do not print.</div><table class="tbl">' + rows.map(function (r) { return '<tr><td style="width:190px">' + r[0] + '</td><td>' + val(r[1]) + '</td></tr>'; }).join('') + '</table><div class="row" style="margin-top:10px"><button class="btn pri" data-act="tab" data-t="info">Edit Project info</button><button class="btn" data-act="nav" data-v="settings">Firm profile</button></div><div class="small muted" style="margin-top:8px">The firm address and the project number label come from the Firm profile in Settings. Turn the cover off for an export in Export presets.</div></div>';
    }
    var on = p.sections.filter(function (s) { return s.on && s.body.trim(); }).length, cons = (p.consultants || []).length, iss = (p.issues || []).length;
    return '<div class="panel"><div class="row"><b style="font-size:15px">Table of contents</b><div class="sp"></div><button class="btn sm" data-act="frontrefresh">Refresh preview</button></div><div class="small muted" style="margin:6px 0 10px">Built automatically from the sections you have included. It is grouped by division, with each section’s page count.</div><table class="tbl"><tr><td style="width:190px">Sections listed</td><td><b>' + on + '</b> included with text</td></tr><tr><td>Consultant specifications</td><td><b>' + cons + '</b> ' + (cons ? 'listed after their division' : '<span class="muted">none added</span>') + '</td></tr><tr><td>Issue and release dates</td><td>' + (iss ? '<b>' + iss + '</b> frozen issue' + (iss > 1 ? 's' : '') + ' drive these' : '<span class="muted">Freeze an issue to fill the dates by section</span>') + '</td></tr></table><div class="row" style="margin-top:10px"><button class="btn pri" data-act="tab" data-t="export">Issue / export</button></div><div class="small muted" style="margin-top:8px">Sections that are unticked or have no text do not appear. The page counts in this preview are the same ones that print.</div></div>';
  }
  var vs1 = viewSections;
  viewSections = function (p) {
    var h = vs1(p);
    h = h.replace('<div id="seclist">', '<div style="padding:0 0 4px;border-bottom:1px solid var(--line2)">' + frontRow('__cover', 'Cover page', 'preview') + frontRow('__toc', 'Table of contents', 'preview') + '</div><div id="seclist">');
    if (isFront()) h = h.replace(/(<div class="col mid" id="mid">)[\s\S]*?(<\/div><div class="col right">)/, function (m, a, b) { return a + midPanel(p) + b; });
    return h;
  };
  var rp0 = refreshPreview;
  refreshPreview = function () { if (isFront()) { frontPreview(); var l = $('#seclist'); var p = proj(); if (l && p) l.innerHTML = listHtml(p); return; } rp0(); };
  function frontPreview() {
    var p = proj(), pv = $('#preview'); if (!p || !pv) return; var my = ++seq, want = ui.code;
    var html = SS.manualHtml(expProject(p), renderedFor(p, 'all', false), { cover: true });
    var sc = Math.min(1, Math.max(0.3, (pv.clientWidth - 8) / 816));
    pv.innerHTML = '<div class="msg muted" style="text-align:center;padding:60px 0">Building preview…</div><div class="fw" style="overflow:hidden;height:0"></div>';
    var wrap = pv.querySelector('.fw'), msg = pv.querySelector('.msg');
    var f = document.createElement('iframe'); f.style.cssText = 'width:816px;height:1056px;border:0;visibility:hidden;transform-origin:top left;transform:scale(' + sc + ')'; wrap.appendChild(f);
    f.onload = function () {
      var tries = 0;
      (function go() {
        if (my !== seq || !document.body.contains(f)) return;
        var w = f.contentWindow;
        if (!w.__ready && tries++ < 150) return setTimeout(go, 100);
        var d = f.contentDocument, pages = [].slice.call(d.querySelectorAll('#out > .pg')), keep = 0;
        pages.forEach(function (pg, i) { var c = pg.querySelector('.hd .c'), isToc = c && /^TABLE OF CONTENTS/.test(c.textContent.trim()), isCover = i === 0 && !!pg.querySelector('.cover'), ok = want === '__cover' ? isCover : isToc; if (ok) keep++; else pg.remove(); });
        if (ui.code !== want) return;
        if (!keep) { msg.textContent = want === '__toc' ? 'Nothing to list yet. Include sections that have text.' : 'No cover page.'; return; }
        var st = d.createElement('style'); st.textContent = 'body{margin:0;background:#e9e9ee}#out>.pg{margin:0 0 14px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)}'; d.head.appendChild(st);
        var h = keep * (1056 + 14); f.style.height = h + 'px'; f.style.visibility = 'visible'; wrap.style.height = Math.round(h * sc) + 'px'; msg.remove();
      })();
    };
    f.srcdoc = html;
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act;
    if (act === 'selpseudo') { ui.code = el.dataset.k; ui.editText = false; render(); }
    else if (act === 'frontrefresh') frontPreview();
  });
})();

/* ================= IMPORT A FINISHED MANUAL AS A NEW PROJECT ================= */
(function () {
  var pm = { list: [], skipped: [], info: {}, busy: false };
  var FLD = [['name', 'Project name'], ['number', 'Project number'], ['owner', 'Owner'], ['address', 'Street address'], ['cityState', 'City, State'], ['phase', 'Issue phase'], ['issueDate', 'Issue date'], ['architect', 'Architect of record'], ['cm', 'Construction management'], ['mep', 'MEP engineer'], ['structural', 'Structural engineer'], ['interior', 'Interior designer'], ['code', 'Governing building code'], ['contractForm', 'Contract form']];
  var INFO_PROMPT = 'Read the COVER PAGE and front matter of this architectural PROJECT MANUAL. Return ONLY a JSON object with these string fields, using "" for anything the pages do not show. Do not guess.\n{"name":"project name","number":"project number","owner":"owner","address":"street address","cityState":"City, ST","phase":"issue name such as Permit Set or Bid Set","issueDate":"date on the cover","architect":"architect of record","cm":"construction manager or general contractor","mep":"MEP engineer","structural":"structural engineer","interior":"interior designer","code":"governing building code if stated","contractForm":"contract form if stated, such as AIA A201-2017"}';
  function open() {
    pm = { list: [], skipped: [], info: {}, busy: false };
    modal('<h2>Import a finished manual as a new project</h2><div class="small muted" style="margin-bottom:10px">Use this when you have already written the specifications. Drop the whole manual as one PDF or Word file, <b>or select all of its Word files at once</b> (one per section, plus the table of contents). Slate reads the project details from the cover or table of contents and creates a project whose sections keep your text exactly as written. You can then finish it, add finishes and consultant sections, and export it. Nothing is saved until you press <b>Create project</b>. About one minute per ' + batchPages() + ' PDF pages. Leave this window open.</div>' +
      '<label class="dz" data-dz="pm"><span class="dzt">✨ Drop the project manual here (one file, or many section files)</span><span class="dzs">or click to browse and select them all</span><input type="file" id="pmfile" data-pmfile="1" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none"></label>' +
      '<div id="prog-manual" class="small" style="margin:10px 0;color:var(--accent-ink)"></div><div id="err-manual" class="small" style="display:none;color:#a33;margin:6px 0"></div><div id="pmreview"></div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Close</button><button class="btn pri" data-act="pmcreate" id="pmcreate" style="display:none">Create project</button></div>', true);
  }
  function review() {
    var el = $('#pmreview'); if (!el) return; var i = pm.info, nsel = pm.list.length;
    el.innerHTML = nsel ? '<h3 style="margin:8px 0 6px">Project details found</h3><div class="small muted" style="margin-bottom:6px">Check these. Anything blank can be filled in later on Project info.</div><div class="two">' +
      FLD.map(function (f) { return '<div class="fld"><label>' + f[1] + '</label><input type="text" id="pm-' + f[0] + '" value="' + esc(i[f[0]] || '') + '"></div>'; }).join('') +
      '<div class="fld"><label>Project type</label><select id="pm-ptype"><option value="">(not set)</option>' + SS.PTYPES.map(function (t) { return '<option value="' + t + '"' + (i.ptype === t ? ' selected' : '') + '>' + esc(SS.PTYPE_LABELS[t]) + '</option>'; }).join('') + '</select></div></div>' +
      '<h3 style="margin:12px 0 6px">Sections found (' + nsel + ')</h3><div style="max-height:34vh;overflow:auto;border:1px solid var(--border);border-radius:8px">' +
      pm.list.map(function (x, k) { var toc = x.code === '01 001'; return '<label class="sec" style="cursor:pointer"><input type="checkbox" data-pmi="' + k + '"' + (toc || x.dup ? '' : ' checked') + '><span class="c">' + esc(x.code) + '</span><span class="t">' + esc(x.title) + '</span><span class="small muted">' + x.body.split('\n').length + ' lines</span>' + (toc ? '<span class="badge n">Slate builds this</span>' : '') + (x.dup ? '<span class="badge r">duplicate number</span>' : '') + (x.file && pm.list.some(function (y) { return y.file !== x.file; }) ? '<span class="small muted">' + esc(x.file) + '</span>' : '') + '</label>'; }).join('') + '</div>' +
      (pm.skipped.length ? '<div class="small" style="color:#a33;margin-top:6px">Pages the AI could not read: ' + pm.skipped.join(', ') + '. Check these sections after importing.</div>' : '') + ((pm.failed || []).length ? '<div class="small" style="color:#a33;margin-top:6px"><b>Files with problems:</b><br>' + pm.failed.map(esc).join('<br>') + '</div>' : '') + (pm.tocName ? '<div class="small muted" style="margin-top:6px">“' + esc(pm.tocName) + '” was used for the project details. Slate rebuilds the table of contents.</div>' : '') +
      '<div class="small muted" style="margin-top:8px">The cover page and table of contents are rebuilt from the project details. Consultant specifications and attachments inside the PDF are not read as sections. Add them on the Consultants tab, or merge them from Issue / export.</div>' : '';
    var b = $('#pmcreate'); if (b) b.style.display = nsel ? '' : 'none';
  }
  var TOC_RE = /table\s*of\s*contents|\btoc\b|^\s*(00|01)\s?0?01\b|contents/i, COVER_RE = /cover|title\s*page|front/i;
  function codeFromName(n) { var m = n.match(/(?:^|[^0-9])(\d{2})[\s._-]?(\d{3}|\d{2}[\s._-]?\d{2})(?!\d)/); return m ? m[1] + ' ' + m[2].replace(/[\s._-]/g, '') : ''; }
  async function infoFrom(f) {
    var ext = (f.name.split('.').pop() || '').toLowerCase(), buf = await readBuf(f), info = {};
    try {
      var raw;
      if (ext === 'docx') raw = await ai(INFO_PROMPT + '\n\nTEXT:\n' + docxText(buf).slice(0, 6000), 2000);
      else { var pdf = await openPdf(buf), bytes = pdf.build ? await pdf.build(0, Math.min(4, pdf.n)) : pdf.whole; raw = (await aiFull([{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64(bytes) } }, { type: 'text', text: INFO_PROMPT }], 2000)).text; }
      var o = parseJson(raw) || {}; FLD.forEach(function (x) { info[x[0]] = str(o[x[0]]).trim(); });
    } catch (e) { info = {}; }
    return info;
  }
  async function readSections(work, many) {
  var results = new Array(work.length), done = 0, failed = [], skipped = [], next = 0;
  async function worker() {
    while (next < work.length) {
      var i = next++, f = work[i];
      try {
        setProg('manual', (many ? 'Reading section files: ' + done + ' of ' + work.length + ' done. Now: ' : 'Reading ') + f.name + '…');
        var got = await extractManual(f, refPrompt), hint = codeFromName(f.name);
        results[i] = got.list.map(function (x) { x.file = f.name; if (!x.code && hint) x.code = hint; return x; }).filter(function (x) { return x.code; });
        if (!results[i].length) failed.push(f.name + ': no specification section found');
        (got.skipped || []).forEach(function (k) { skipped.push(many ? f.name + ' p.' + k : k); });
      } catch (err) { results[i] = []; failed.push(f.name + ': ' + (err && err.message || err)); }
      done++;
    }
  }
  await Promise.all([worker(), worker(), worker()].slice(0, Math.min(3, work.length)));
  var list = [], seen = {};
  results.forEach(function (r) { (r || []).forEach(function (x) { x.dup = !!seen[x.code]; seen[x.code] = true; list.push(x); }); });
  list.sort(function (a, b) { return SS.sortCodes(a.code, b.code); });
    return { list: list, failed: failed, skipped: skipped };
  }
  async function run(files) {
    files = files.slice().sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
    var many = files.length > 1, tocF = many ? files.filter(function (f) { return TOC_RE.test(f.name.replace(/\.[^.]+$/, '')); })[0] : null, covF = many ? files.filter(function (f) { return COVER_RE.test(f.name); })[0] : null;
    var srcF = covF || tocF || files[0], work = files.filter(function (f) { return f !== tocF && f !== covF; });
    setProg('manual', 'Reading the project details from ' + srcF.name + '…');
    var info = await infoFrom(srcF); if (!info.name && many && srcF !== files[0]) info = Object.assign(await infoFrom(files[0]), info);
    if (!info.name) info.name = (many ? '' : srcF.name.replace(/\.[^.]+$/, '')).replace(/[_\-]+/g, ' ').replace(/project manual/i, '').trim();
    info.ptype = guessType(info.name || '');
    var rs = await readSections(work, many), list = rs.list, failed = rs.failed, skipped = rs.skipped;
    pm.info = info; pm.list = list; pm.skipped = skipped; pm.failed = failed; pm.tocName = tocF ? tocF.name : '';
    setProg('manual', list.length ? 'Done: ' + list.length + ' sections found' + (failed.length ? ', ' + failed.length + ' file' + (failed.length > 1 ? 's' : '') + ' with problems' : '') + '. Review below, then create the project.' : 'No specification sections were found.');
    review();
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.dataset || !t.dataset.pmfile || !t.files.length) return;
    var fs = [].slice.call(t.files); t.value = ''; pm.list = []; pm.skipped = []; pm.failed = []; review(); setErr('manual', '');
    withBusy('pmimport', null, async function () { try { await run(fs); } catch (err) { setProg('manual', ''); setErr('manual', String(err && err.message || err)); throw err; } })();
  });
  function create() {
    var np = { id: SS.uid(), created: Date.now(), sections: [], notes: '' };
    FLD.forEach(function (f) { np[f[0]] = ($('#pm-' + f[0]).value || '').trim(); }); np.ptype = $('#pm-ptype').value;
    if (!np.name) return toast('Give the project a name.');
    np.architect = np.architect || settings.architect || 'ai3, Inc.';
    [].forEach.call(document.querySelectorAll('[data-pmi]'), function (c) {
      if (!c.checked) return; var x = pm.list[+c.dataset.pmi], ns = newSection(x.code, x.title);
      ns.title = x.title || ns.title; ns.body = x.body; ns.questions = []; ns.answers = {}; ns.libRev = (library[x.code] && library[x.code].rev) || 0; np.sections.push(ns);
    });
    if (!np.sections.length) return toast('Tick at least one section.');
    np.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); });
    projects.unshift(np); saveProjects(); closeModal(); ui.view = 'project'; ui.pid = np.id; ui.tab = 'overview'; ui.code = np.sections[0].code; render();
    toast(np.sections.length + ' sections imported as written. Review the project details next.', 6000);
  }

  /* ----- add sections from files to the open project ----- */
  var ad = { list: [], failed: [] };
  function openAdd() {
    ad = { list: [], failed: [] };
    modal('<h2>Import sections from files</h2><div class="small muted" style="margin-bottom:10px">Select the Word or PDF files for the sections you want to add to this project. Slate keeps your text exactly as written. A file named like “Table of Contents” is skipped. Nothing changes until you press <b>Add to project</b>.</div>' +
      '<label class="dz" data-dz="pm"><span class="dzt">✨ Drop section files here (select as many as you like)</span><span class="dzs">or click to browse</span><input type="file" id="pmfile" data-pmadd="1" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none"></label>' +
      '<div id="prog-manual" class="small" style="margin:10px 0;color:var(--accent-ink)"></div><div id="err-manual" class="small" style="display:none;color:#a33;margin:6px 0"></div><div id="pmreview"></div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Close</button><button class="btn pri" data-act="pmaddgo" id="pmaddgo" style="display:none">Add to project</button></div>', true);
  }
  function reviewAdd() {
    var el = $('#pmreview'), p = proj(); if (!el) return;
    el.innerHTML = ad.list.length ? '<h3 style="margin:8px 0 6px">Sections found (' + ad.list.length + ')</h3><div style="max-height:40vh;overflow:auto;border:1px solid var(--border);border-radius:8px">' + ad.list.map(function (x, k) {
      var ex = p.sections.some(function (s) { return s.code === x.code; });
      return '<label class="sec" style="cursor:pointer"><input type="checkbox" data-pmi="' + k + '"' + (ex || x.dup ? '' : ' checked') + '><span class="c">' + esc(x.code) + '</span><span class="t">' + esc(x.title) + '</span>' + (ex ? '<span class="badge r">already in project: replaces its text</span>' : '<span class="badge g">new</span>') + (x.dup ? '<span class="badge r">duplicate number</span>' : '') + '<span class="small muted">' + esc(x.file || '') + '</span></label>';
    }).join('') + '</div><div class="small muted" style="margin-top:6px">Sections that are already in the project are left unticked. Tick one to replace its text; the old text stays in that section’s History.</div>' : '';
    if (ad.failed.length) el.innerHTML += '<div class="small" style="color:#a33;margin-top:6px"><b>Files with problems:</b><br>' + ad.failed.map(esc).join('<br>') + '</div>';
    var b = $('#pmaddgo'); if (b) b.style.display = ad.list.length ? '' : 'none';
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.dataset || !t.dataset.pmadd || !t.files.length) return;
    var fs = [].slice.call(t.files).filter(function (f) { return !TOC_RE.test(f.name.replace(/\.[^.]+$/, '')); }); t.value = ''; ad = { list: [], failed: [] }; reviewAdd(); setErr('manual', '');
    if (!fs.length) return setProg('manual', 'Those files look like tables of contents. Slate builds that itself.');
    withBusy('pmadd', null, async function () {
      try {
        fs.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
        var rs = await readSections(fs, fs.length > 1); ad = { list: rs.list, failed: rs.failed.concat(rs.skipped.length ? ['Pages the AI could not read: ' + rs.skipped.join(', ')] : []) };
        setProg('manual', ad.list.length ? 'Done: ' + ad.list.length + ' section' + (ad.list.length > 1 ? 's' : '') + ' found. Review below.' : 'No specification sections were found.'); reviewAdd();
      } catch (err) { setProg('manual', ''); setErr('manual', String(err && err.message || err)); throw err; }
    })();
  });
  function addGo() {
    var p = proj(), n = 0, r = 0;
    [].forEach.call(document.querySelectorAll('[data-pmi]'), function (c) {
      if (!c.checked) return; var x = ad.list[+c.dataset.pmi], ex = p.sections.filter(function (s) { return s.code === x.code; })[0];
      if (ex) { ex.title = x.title || ex.title; ex.body = x.body; ex.questions = []; ex.answers = {}; ex.on = true; ex.status = 'draft'; r++; }
      else { var ns = newSection(x.code, x.title); ns.title = x.title || ns.title; ns.body = x.body; ns.questions = []; ns.answers = {}; ns.libRev = (library[x.code] && library[x.code].rev) || 0; p.sections.push(ns); n++; }
    });
    if (!n && !r) return toast('Tick at least one section.');
    p.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); }); saveProjects(); closeModal(); ui.tab = 'sections'; render();
    toast(n + ' added' + (r ? ', ' + r + ' replaced' : '') + '.', 5000);
  }
  var vs3 = viewSections;
  viewSections = function (p) { return vs3(p).replace('<div style="padding:6px 8px"><input type="text" data-secq', '<div style="padding:6px 8px 0"><button class="btn sm" data-act="pmaddopen" style="width:100%" title="Add sections from Word or PDF files">Import sections from files…</button></div><div style="padding:6px 8px"><input type="text" data-secq'); };
  document.addEventListener('click', function (e) { var el = e.target.closest('[data-act]'); if (!el) return; if (el.dataset.act === 'pmaddopen') openAdd(); else if (el.dataset.act === 'pmaddgo') addGo(); });
  var vp1 = viewProjects;
  viewProjects = function () { return vp1().replace('<button class="btn pri" data-act="newproj">', '<button class="btn" data-act="pmopen" title="Create a project from a manual you have already written">Import a manual…</button><button class="btn pri" data-act="newproj">'); };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act;
    if (act === 'pmopen') open(); else if (act === 'pmcreate') create();
  });
})();

/* ================= STANDARD DOCUMENTS (AIA General Conditions and other licensed PDFs, saved once) ================= */
(function () {
  var KEY = 'ss1_stddocs';
  function list() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  function guessLabel(n) { return n.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim(); }
  window.stdAdd = async function (files) {
    var l = list(), n = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i]; if (!/\.pdf$/i.test(f.name)) { toast(f.name + ' is not a PDF.'); continue; }
      if (l.some(function (d) { return d.name === f.name && d.size === f.size; })) { toast(f.name + ' is already saved.'); continue; }
      var id = SS.uid(); try { await window.__fs.put('std_' + id, f); } catch (e) { toast('⚠ Could not store ' + f.name + ' in this browser.'); continue; }
      l.push({ id: id, name: f.name, label: guessLabel(f.name), size: f.size, at: Date.now(), def: false, url: '' }); n++;
    }
    save(l); if (n) { toast(n + ' document' + (n > 1 ? 's' : '') + ' saved'); render(); }
  };
  function mb(x) { return (x / 1048576).toFixed(1) + ' MB'; }
  function panel() {
    var l = list();
    return '<div class="panel"><h2>Standard documents</h2><div class="small muted" style="margin-bottom:8px">Save your licensed AIA forms (A201 General Conditions, A101 Agreement and others) once. They are ready to add to any project’s merged PDF. Files stay in this browser on this computer: they are not uploaded, not sent to AI, and not part of cloud sync or backup, so keep your original copies.</div>' +
      (l.length ? '<table class="tbl"><tr><th>Name in the manual</th><th>Where to get it (link)</th><th>Add by default</th><th></th></tr>' + l.map(function (d, i) { return '<tr><td><input type="text" data-sdlabel="' + i + '" value="' + esc(d.label) + '" style="width:100%;padding:4px 6px"><div class="small muted">' + esc(d.name) + ' • ' + mb(d.size) + '</div></td><td><input type="text" data-sdurl="' + i + '" value="' + esc(d.url || '') + '" placeholder="https://…" style="width:100%;padding:4px 6px">' + (d.url ? '<a class="small" href="' + esc(d.url) + '" target="_blank" rel="noopener">Open</a>' : '') + '</td><td style="text-align:center"><input type="checkbox" data-sddef="' + i + '"' + (d.def ? ' checked' : '') + '></td><td><button class="btn sm danger" data-act="sddel" data-i="' + i + '">✕</button></td></tr>'; }).join('') + '</table>' : '<div class="small muted" style="margin-bottom:8px">None saved yet.</div>') +
      '<label class="dz" data-dz="std" style="margin-top:10px"><span class="dzt">✨ Drop AIA forms or other PDFs here</span><span class="dzs">or click to browse</span><input type="file" multiple accept=".pdf,application/pdf" id="stdfile" data-stdfile="1" style="display:none"></label></div>';
  }
  var vs2 = viewSettings;
  viewSettings = function () { return vs2().replace('<div class="panel"><h2>Cloud &amp; backup</h2>', panel() + '<div class="panel"><h2>Cloud &amp; backup</h2>'); };
  function pre(p, d) { var cf = ((p && p.contractForm) || '').toLowerCase().replace(/[^a-z0-9]/g, ''), key = (d.label + ' ' + d.name).toLowerCase().replace(/[^a-z0-9]+/g, ' '); var m = key.match(/\b[a-z]\d{3}\b/); return d.def || (m && cf && cf.indexOf(m[0]) >= 0); }
  window.stdPickHtml = function (p) {
    var l = list();
    if (!l.length) return '<div class="small muted" style="margin-top:8px">Tip: save your AIA General Conditions once under Settings → Standard documents and they will be listed here for every project.</div>';
    return '<div style="margin-top:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px"><div class="small" style="margin-bottom:4px"><b>Your standard documents</b></div>' + l.map(function (d) { return '<label class="small" style="display:block;padding:2px 0"><input type="checkbox" data-stdpick="' + d.id + '"' + (pre(p, d) ? ' checked' : '') + '> ' + esc(d.label) + (d.url ? ' <a href="' + esc(d.url) + '" target="_blank" rel="noopener">link</a>' : '') + '</label>'; }).join('') + '<button class="btn sm" data-act="sdpickadd" style="margin-top:6px">Add checked documents</button></div>';
  };
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.dataset) return;
    if (t.dataset.stdfile) { var fs = [].slice.call(t.files); t.value = ''; window.stdAdd(fs); return; }
    var l = list(), k;
    if (t.dataset.sdlabel !== undefined) { k = +t.dataset.sdlabel; if (l[k]) { l[k].label = t.value.trim() || l[k].label; save(l); } }
    else if (t.dataset.sdurl !== undefined) { k = +t.dataset.sdurl; if (l[k]) { l[k].url = t.value.trim(); save(l); render(); } }
    else if (t.dataset.sddef !== undefined) { k = +t.dataset.sddef; if (l[k]) { l[k].def = t.checked; save(l); } }
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act;
    if (act === 'sddel') { var l = list(), d = l[+el.dataset.i]; if (d && confirm('Remove “' + d.label + '” from your standard documents? Your original file is not affected.')) { window.__fs.del('std_' + d.id); l.splice(+el.dataset.i, 1); save(l); render(); } }
    else if (act === 'sdpickadd') {
      var ids = [].map.call(document.querySelectorAll('[data-stdpick]:checked'), function (c) { return c.dataset.stdpick; }), l2 = list(); if (!ids.length) return toast('Tick the documents to add.');
      Promise.all(ids.map(function (id) { var d = l2.filter(function (x) { return x.id === id; })[0]; return window.__fs.get('std_' + id).then(function (b) { if (!b) throw new Error('“' + d.label + '” is missing from this browser. Add it again in Settings.'); var f = new File([b], d.name, { type: 'application/pdf' }); f.__label = d.label; return f; }); })).then(function (files) { window.mgAdd(files); }, function (err) { toast('⚠ ' + err.message, 6000); });
    }
  });
})();


/* ================= VERSION LABEL ================= */
(function () {
  var V = '3.18';
  window.SS_VERSION = V;
  var h0 = window.viewHelp, vs9 = viewSettings;
  window.viewHelp = function () { return h0().replace('How to use Slate Specs, from the first project to issuing the set.', 'How to use Slate Specs, from the first project to issuing the set. <span class="small">You are running version ' + V + '.</span>'); };
  viewSettings = function () { return vs9().replace('<div class="panel"><h2>Firm profile</h2>', '<div class="small muted" style="margin-bottom:8px">Slate Specs version ' + V + '</div><div class="panel"><h2>Firm profile</h2>'); };
})();


/* ================= RUNNING HEADER/FOOTER IN SECTION PREVIEW ================= */
(function () {
  var rp0 = refreshPreview;
  refreshPreview = function () {
    rp0.apply(this, arguments);
    try {
      var pv = $('#preview'), p = proj(), s = curSec(); if (!pv || !p || !s) return;
      var sec = pv.querySelector('.sp-sec'); if (!sec || pv.querySelector('.rhf')) return;
      var title = (s.title || '').toUpperCase(), code = 'SECTION ' + s.code, st = p.phase || '', dt = p.issueDate || '', loc = p.cityState || '';
      var c = 'font:8.5pt/1.35 \'Century Gothic\',Questrial,Arial,sans-serif;color:#222;';
      var hd = '<div class="rhf" style="' + c + 'display:flex;justify-content:space-between;padding:4px 0 14px;margin-bottom:6px;border-bottom:1px solid #ddd;position:sticky;top:-44px;background:#fff;z-index:2"><div style="flex:1"></div><div style="flex:2;text-align:center">' + esc(title) + '<br>' + esc(code) + '</div><div style="flex:1;text-align:right">' + (st ? esc(st) : '<span style="color:#aaa">[Phase]</span>') + '<br>' + (dt ? esc(dt) : '<span style="color:#aaa">[Issue date]</span>') + '</div></div>';
      var ft = '<div class="rhf" style="' + c + 'font-size:8pt;text-align:right;padding:10px 0 4px;margin-top:14px;border-top:1px solid #ddd;position:sticky;bottom:-16px;background:#fff;z-index:2">' + esc((p.name || '').toUpperCase()) + (loc ? '<br>' + esc(loc) : '') + '<br>' + esc(s.code) + '-1</div>';
      sec.insertAdjacentHTML('beforebegin', hd); sec.insertAdjacentHTML('afterend', ft);
    } catch (e) { /* preview only */ }
  };
})();


/* ================= EMBEDDED QUESTRIAL (Century Gothic look-alike) ================= */
(function () { try { var st = document.createElement('style'); st.id = 'qfont'; st.textContent = SS.FONTFACE; document.head.appendChild(st); } catch (e) {} })();


/* ================= REUSE: copy sections from another project OR a reference project ================= */
(function () {
  var st = { src: '', q: '' };
  function sources(p) {
    var live = projects.filter(function (x) { return x.id !== p.id && x.sections.some(function (q) { return (q.body || '').trim(); }); });
    return { live: live, ref: archive.filter(function (a) { return a.sections && a.sections.length; }) };
  }
  function secsOf(src) {
    if (!src) return [];
    if (src.kind === 'p') { var x = projects.filter(function (y) { return y.id === src.id; })[0]; return x ? x.sections.filter(function (q) { return (q.body || '').trim(); }) : []; }
    var a = archById(src.id); return a ? a.sections.filter(function (q) { return (q.body || '').trim(); }) : [];
  }
  function parse(v) { return v ? { kind: v.charAt(0), id: v.slice(2) } : null; }
  function open(keep) {
    var p = proj(), S = sources(p);
    if (!S.live.length && !S.ref.length) return toast('No other projects or reference projects with sections yet.');
    if (!st.src || !(S.live.some(function (x) { return 'p:' + x.id === st.src; }) || S.ref.some(function (x) { return 'a:' + x.id === st.src; }))) st.src = S.live.length ? 'p:' + S.live[0].id : 'a:' + S.ref[0].id;
    var src = parse(st.src), isRef = src.kind === 'a', q = st.q.trim().toLowerCase();
    var list = secsOf(src).filter(function (x) { return !q || (x.code + ' ' + x.title + ' ' + x.body).toLowerCase().indexOf(q) >= 0; });
    var opts = (S.live.length ? '<optgroup label="Your projects">' + S.live.map(function (x) { return '<option value="p:' + x.id + '"' + ('p:' + x.id === st.src ? ' selected' : '') + '>' + esc(x.name || 'Untitled') + '</option>'; }).join('') + '</optgroup>' : '') +
      (S.ref.length ? '<optgroup label="Reference projects">' + S.ref.map(function (x) { return '<option value="a:' + x.id + '"' + ('a:' + x.id === st.src ? ' selected' : '') + '>' + esc(x.name || 'Untitled') + '</option>'; }).join('') + '</optgroup>' : '');
    var rows = list.map(function (x) {
      var have = p.sections.some(function (y) { return y.code === x.code; });
      return '<label class="sec" style="cursor:pointer"><input type="checkbox" data-ruse="' + esc(x.code) + '"><span class="c">' + esc(x.code) + '</span><span class="t">' + esc(x.title) + '</span>' + (have ? '<span class="badge">replaces</span>' : '<span class="badge g">new</span>') + '</label>';
    }).join('') || '<div class="empty">No sections match.</div>';
    var h = '<h2>Copy sections into this project</h2><div class="fld"><label>Copy from</label><select data-ruse-src>' + opts + '</select></div>' +
      '<div class="row" style="margin-bottom:6px"><input type="text" id="rusq" value="' + esc(st.q) + '" style="flex:1;padding:8px 12px;border-radius:999px" placeholder="Search by section number, title or wording"><button class="btn sm" data-act="rusall">Select all shown</button></div>' +
      '<div id="rusrows" style="max-height:44vh;overflow:auto">' + rows + '</div>' +
      (isRef ? '<div class="small muted" style="margin-top:8px">Reference projects keep the text as written. Fill in the project-specific answers after copying.</div>' : '<div class="small" style="margin-top:8px"><label><input type="checkbox" id="rusans" checked> Copy answers and notes too (otherwise answers start blank)</label></div>') +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" data-act="rusgo">Copy selected</button></div>';
    modal(h);
    if (keep) { var qi = $('#rusq'); if (qi) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); } }
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act;
    if (act === 'reuse') { e.stopImmediatePropagation(); st.q = ''; open(); }
    else if (act === 'rusall') { [].forEach.call(document.querySelectorAll('[data-ruse]'), function (c) { c.checked = true; }); }
    else if (act === 'rusgo') {
      var p = proj(), src = parse(st.src), n = 0, keep = $('#rusans') ? $('#rusans').checked : true;
      [].forEach.call(document.querySelectorAll('[data-ruse]:checked'), function (c) {
        var o = secsOf(src).filter(function (x) { return x.code === c.dataset.ruse; })[0]; if (!o) return;
        if (src.kind === 'p') {
          var nu = clone(o); nu.on = true; nu.status = 'draft'; if (!keep) { nu.answers = {}; nu.aiKeys = []; nu.notes = ''; }
          var i = p.sections.findIndex(function (x) { return x.code === nu.code; }); if (i >= 0) p.sections[i] = nu; else p.sections.push(nu);
        } else {
          var ex = p.sections.filter(function (x) { return x.code === o.code; })[0];
          if (ex) { ex.body = o.body; ex.on = true; ex.status = 'draft'; }
          else { var ns = newSection(o.code, o.title); ns.title = o.title; ns.body = o.body; ns.questions = []; ns.libRev = 0; p.sections.push(ns); }
        }
        n++;
      });
      if (!n) return toast('Tick at least one section.');
      p.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); }); saveProjects(); closeModal(); render(); toast('Copied ' + n + ' section' + (n === 1 ? '' : 's'));
    }
  }, true);
  document.addEventListener('change', function (e) { if (e.target.dataset.ruseSrc !== undefined) { st.src = e.target.value; open(); } });
  document.addEventListener('input', function (e) { if (e.target.id === 'rusq') { st.q = e.target.value; open(true); } });
})();


/* ================= LIVE EDIT IN THE SECTION PREVIEW ================= */
(function () {
  var rp1 = refreshPreview;
  function norm(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
  function items(r) {
    var L = [];
    r.parts.forEach(function (pt) { L.push({ k: 'part', src: pt.src, title: pt.title });
      pt.articles.forEach(function (ar) { L.push({ k: 'art', src: ar.src, title: ar.title });
        ar.paras.forEach(function (pa) { L.push(pa.note ? { k: 'note' } : { k: 'p', src: pa.src, pa: pa }); }); }); });
    return L;
  }
  function rawMap(body) {
    var M = {}; SS.parseBody(body).forEach(function (pt) {
      if (pt.src != null) M[pt.src] = { k: 'part', t: pt.title };
      pt.articles.forEach(function (ar) { if (ar.src != null) M[ar.src] = { k: 'art', t: ar.title, cond: ar.cond };
        ar.paras.forEach(function (pa) { M[pa.src] = { k: 'p', t: pa.t, cond: pa.cond, cont: pa.cont, l: pa.l, note: pa.note }; }); });
    }); return M;
  }
  function mark(el, it, raw) { el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'true'); el.dataset.lsrc = it.src; el.classList.add('lve'); }
  refreshPreview = function () {
    rp1.apply(this, arguments);
    try {
      var pv = $('#preview'), p = proj(), s = curSec(); if (!pv || !p || !s || !s.body.trim()) return;
      var sec = pv.querySelector('.sp-sec'); if (!sec) return;
      if (!document.getElementById('lvecss')) { var c = document.createElement('style'); c.id = 'lvecss'; c.textContent = '.lve{outline:none;border-radius:3px;cursor:text}.lve:hover{background:rgba(255,230,120,.28)}.lve:focus{background:#fffbe0;box-shadow:0 0 0 2px #e6c84a}.lve.dyn:focus{box-shadow:0 0 0 2px #7aa7ff;background:#eef4ff}.lvehint{font:11px/1.4 inherit;color:#8a8a8a;margin:0 0 8px;text-align:center}'; document.head.appendChild(c); }
      var its = items(SS.render(s, p, { notes: !!ui.notes })), M = rawMap(s.body);
      var els = sec.querySelectorAll('.sp-part,.sp-art,.sp-p,.sp-note');
      if (els.length !== its.length) return;
      [].forEach.call(els, function (el, i) {
        var it = its[i]; if (it.k === 'note' || it.src == null) return; var raw = M[it.src]; if (!raw) return;
        if (it.k === 'p') { var t = el.querySelector('.sp-t'); if (!t) return; mark(t, it); t.dataset.kind = 'p'; t.dataset.rendered = norm(t.textContent); if (norm(raw.t) !== t.dataset.rendered) { t.classList.add('dyn'); t.title = 'This paragraph contains project fields or options. Click to edit the underlying text.'; } }
        else if (it.k === 'art') { var a = el.querySelector('.sp-at'); if (!a) return; mark(a, it); a.dataset.kind = 'art'; a.dataset.rendered = norm(a.textContent); if (norm(raw.t) !== a.dataset.rendered) a.classList.add('dyn'); }
        else if (it.k === 'part') { var m = /^(PART \d+ - )(.*)$/.exec(el.textContent); if (!m) return; el.innerHTML = '<span>' + esc(m[1]) + '</span><span class="pt">' + esc(m[2]) + '</span>'; var pt = el.querySelector('.pt'); mark(pt, it); pt.dataset.kind = 'part'; pt.dataset.rendered = norm(m[2]); }
      });
      if (!pv.parentNode.querySelector('.lvehint')) pv.insertAdjacentHTML('beforebegin', '<div class="lvehint">Click any text to edit it here. Enter saves, Esc cancels.</div>');
    } catch (e) { /* preview only */ }
  };
  var orig = null;
  document.addEventListener('focusin', function (e) {
    var t = e.target; if (!t.classList || !t.classList.contains('lve')) return;
    var s = curSec(), M = rawMap(s.body), raw = M[t.dataset.lsrc]; if (!raw) return;
    orig = { el: t, text: t.textContent };
    if (t.classList.contains('dyn')) { t.textContent = raw.t; try { var rg = document.createRange(); rg.selectNodeContents(t); rg.collapse(false); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rg); } catch (e) {} }
    t.dataset.start = norm(t.textContent);
  });
  function commit(t, cancel) {
    var s = curSec(), p = proj(); if (!s || !t || !t.classList.contains('lve')) return;
    var val = norm(t.textContent);
    if (cancel || val === t.dataset.start) { refreshPreview(); return; }
    var lines = s.body.split(/\r?\n/), i = +t.dataset.lsrc, M = rawMap(s.body), raw = M[i]; if (!raw || lines[i] == null) { refreshPreview(); return; }
    if (!val) { toast('Empty text not saved. Use Edit section text to delete lines.'); refreshPreview(); return; }
    if (t.dataset.kind === 'p') {
      var m = /^([1-4NnS]):\s?/.exec(lines[i]), cond = raw.cond ? ' ?(' + raw.cond + ')' : '';
      lines[i] = (m ? m[1] + ': ' : '1: ') + val + cond;
      (raw.cont || []).slice().sort(function (a, b) { return b - a; }).forEach(function (ci) { lines.splice(ci, 1); });
    } else if (t.dataset.kind === 'art') { lines[i] = '## ' + val + (raw.cond ? ' ?(' + raw.cond + ')' : ''); }
    else if (t.dataset.kind === 'part') { lines[i] = '# ' + val; }
    s.body = lines.join('\n'); saveProjects();
    var ta = document.querySelector('[data-body]'); if (ta) ta.value = s.body;
    refreshPreview(); toast('Saved');
  }
  document.addEventListener('focusout', function (e) { var t = e.target; if (t.classList && t.classList.contains('lve') && document.body.contains(t)) commit(t, false); });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!t.classList || !t.classList.contains('lve')) return;
    if (e.key === 'Enter') { e.preventDefault(); t.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); t.textContent = orig ? orig.text : t.textContent; t.dataset.start = norm(t.textContent); t.blur(); }
  });
  document.addEventListener('paste', function (e) { var t = e.target; if (t.classList && t.classList.contains('lve')) { e.preventDefault(); var x = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '); document.execCommand('insertText', false, x); } });
})();


/* ================= MARK ALL SECTIONS FINAL ================= */
(function () {
  var vs = viewSections;
  viewSections = function (p) {
    var h = vs.apply(this, arguments);
    return h.replace('<b>Preview</b><div class="sp"></div>', '<b>Preview</b><div class="sp"></div><button class="btn sm" data-act="histundo" title="Put back the text from before the last change">↶ Undo</button><button class="btn sm" data-act="histopen" title="Earlier versions of this section">History</button>').replace('<button class="btn sm" data-act="reuse"', '<button class="btn sm" data-act="allfinal" title="Mark every included section final">All final</button><button class="btn sm" data-act="reuse"');
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act="allfinal"]'); if (!el) return; e.stopImmediatePropagation();
    var p = proj(); if (!p) return;
    var inc = p.sections.filter(function (s) { return s.on !== false && (s.body || '').trim(); });
    var todo = inc.filter(function (s) { return s.status !== 'final'; });
    if (!inc.length) return toast('No included sections with text.');
    if (!todo.length) { if (confirm('All ' + inc.length + ' included sections are already final. Set them all back to Draft?')) { inc.forEach(function (s) { s.status = 'draft'; }); saveProjects(); render(); toast('All sections set to Draft'); } return; }
    var open = todo.filter(function (s) { return SS.render(s, p, {}).unresolved > 0; }).length;
    if (!confirm('Mark ' + todo.length + ' section' + (todo.length === 1 ? '' : 's') + ' final?' + (open ? '\n\n' + open + ' still ha' + (open === 1 ? 's' : 've') + ' open items (blank answers). You can still mark them final, and the pre-issue check will list them.' : '') + '\n\nOnly included sections with text change. Undo or each section\'s status menu reverses it.')) return;
    todo.forEach(function (s) { s.status = 'final'; }); saveProjects(); render(); toast(todo.length + ' section' + (todo.length === 1 ? '' : 's') + ' marked final');
  }, true);
})();


/* ================= FIND & REPLACE ================= */
(function () {
  var fr = { q: '', r: '', cs: false, ww: false, scope: 'all', exc: false };
  var TOK = /(\{\{[^}]*\}\}|\?\([^)]*\))/;
  function rx() {
    var q = fr.q; if (!q) return null; var e = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (fr.ww) e = '(?<![\\w])' + e + '(?![\\w])';
    return new RegExp(e, fr.cs ? 'g' : 'gi');
  }
  function lineSplit(line) { var m = /^(\s*(?:[1-4NnS]:\s?|#{1,2}\s+))([\s\S]*)$/.exec(line); return m ? [m[1], m[2]] : ['', line]; }
  function procLine(line, re, rep) {
    var sp = lineSplit(line), n = 0, parts = sp[1].split(TOK);
    for (var i = 0; i < parts.length; i += 2) parts[i] = parts[i].replace(re, function (m) { n++; return rep == null ? m : rep; });
    return { line: sp[0] + parts.join(''), n: n };
  }
  function scan() {
    var p = proj(), re = rx(), out = []; if (!p || !re) return out;
    var secs = p.sections.filter(function (s) { return (fr.scope === 'one' ? s.code === ui.code : (fr.exc || s.on !== false)); });
    secs.forEach(function (s) {
      var lines = s.body.split(/\r?\n/), L = [];
      lines.forEach(function (ln, i) { var t = procLine(ln, re, null); if (t.n) L.push({ i: i, text: lineSplit(ln)[1], n: t.n }); });
      if (L.length) out.push({ s: s, lines: L, total: L.reduce(function (a, b) { return a + b.n; }, 0) });
    });
    return out;
  }
  function hl(text, re) {
    var parts = text.split(TOK), h = '';
    parts.forEach(function (pt, i) { h += i % 2 ? '<span class="muted">' + esc(pt) + '</span>' : esc(pt).replace(new RegExp(re.source.replace(/&/g, '&amp;'), re.flags), function (m) { return '<mark>' + m + '</mark>'; }); });
    return h;
  }
  function results() {
    var el = $('#frres'); if (!el) return; var re = rx();
    if (!re) { el.innerHTML = '<div class="small muted">Type the word or phrase to find.</div>'; fr.hits = []; return; }
    var hits = scan(); fr.hits = hits;
    var tot = hits.reduce(function (a, h) { return a + h.total; }, 0);
    el.innerHTML = (hits.length ? '<div class="small muted" style="margin-bottom:6px">' + tot + ' match' + (tot === 1 ? '' : 'es') + ' in ' + hits.length + ' section' + (hits.length === 1 ? '' : 's') + '. Untick any line you want to leave alone.</div>' : '<div class="empty">Nothing found.</div>') +
      hits.map(function (h, hi) {
        return '<div style="margin-bottom:8px"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" data-frsec="' + hi + '" checked><span class="c">' + esc(h.s.code) + '</span> ' + esc(h.s.title) + (h.s.on === false ? ' <span class="badge">excluded</span>' : '') + ' <span class="small muted">' + h.total + '</span><span class="sp"></span><a href="#" data-act="gotosec" data-code="' + esc(h.s.code) + '" class="small">Open</a></label>' +
          h.lines.slice(0, 60).map(function (l) { var after = fr.r !== '' || true ? procLine((l.text), re, fr.r).line : ''; return '<label style="display:flex;gap:8px;padding:3px 0 3px 22px;font-size:12px;line-height:1.45"><input type="checkbox" data-frln="' + hi + ':' + l.i + '" checked><span>' + hl(l.text.length > 220 ? snippet(l.text, re) : l.text, re) + (fr.r !== '' ? '<br><span style="color:#2a7a3b">→ ' + esc((function (t) { return t.length > 220 ? t.slice(0, 220) + '…' : t; })(procLine(l.text, re, fr.r).line)) + '</span>' : '') + '</span></label>'; }).join('') + (h.lines.length > 60 ? '<div class="small muted" style="padding-left:22px">+ ' + (h.lines.length - 60) + ' more lines (all are replaced if the section is ticked)</div>' : '') + '</div>';
      }).join('');
    var b = $('#frgo'); if (b) b.disabled = !hits.length;
  }
  function snippet(t, re) { var m = re.exec(t); re.lastIndex = 0; var at = m ? m.index : 0; return (at > 80 ? '…' : '') + t.slice(Math.max(0, at - 80), at + 140) + '…'; }
  function open() {
    var p = proj(); if (!p) return;
    fr.q = fr.q || ''; var sel = ''; try { sel = String(window.getSelection() || '').trim(); } catch (e) {} if (sel && sel.length < 80 && sel.indexOf('\n') < 0) fr.q = sel;
    modal('<h2>Find and replace</h2>' +
      '<div class="two"><div class="fld"><label>Find</label><input type="text" id="frq" value="' + esc(fr.q) + '" placeholder="word or phrase" autocomplete="off"></div><div class="fld"><label>Replace with</label><input type="text" id="frr" value="' + esc(fr.r) + '" placeholder="(leave blank to delete the text)" autocomplete="off"></div></div>' +
      '<div class="row small" style="gap:14px;margin:2px 0 10px;flex-wrap:wrap"><label><input type="checkbox" id="frcs"' + (fr.cs ? ' checked' : '') + '> Match case</label><label><input type="checkbox" id="frww"' + (fr.ww ? ' checked' : '') + '> Whole words only</label><label><input type="checkbox" id="frexc"' + (fr.exc ? ' checked' : '') + '> Include sections left out of the manual</label><span class="sp"></span><select id="frscope"><option value="all"' + (fr.scope === 'all' ? ' selected' : '') + '>All sections</option><option value="one"' + (fr.scope === 'one' ? ' selected' : '') + '>Only the selected section</option></select></div>' +
      '<div id="frres" style="max-height:46vh;overflow:auto"></div>' +
      '<div class="small muted" style="margin-top:6px">Replaces the section text only. Project fields such as {{project.name}} and conditions are never touched. Each changed section keeps its earlier text, so ↶ Undo and History bring it back.</div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Close</button><button class="btn pri" id="frgo" data-act="frgo" disabled>Replace selected</button></div>');
    results(); setTimeout(function () { var i = $('#frq'); if (i) { i.focus(); i.select(); } }, 30);
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    if (el.dataset.act === 'fropen') open();
    else if (el.dataset.act === 'frgo') {
      var re = rx(), hits = fr.hits || [], n = 0, ns = 0; if (!re) return;
      var cnt = document.querySelectorAll('[data-frln]:checked').length; if (!cnt) return toast('Nothing ticked.');
      if (!confirm('Replace ' + (fr.q) + ' with ' + (fr.r === '' ? '(nothing)' : fr.r) + ' in ' + cnt + ' line' + (cnt === 1 ? '' : 's') + '?')) return;
      hits.forEach(function (h, hi) {
        var lines = h.s.body.split(/\r?\n/), ch = false;
        h.lines.forEach(function (l) { var cb = document.querySelector('[data-frln="' + hi + ':' + l.i + '"]'); var sec = document.querySelector('[data-frsec="' + hi + '"]'); var on = cb ? cb.checked : (sec && sec.checked); if (!on) return; var t = procLine(lines[l.i], re, fr.r); if (t.n) { lines[l.i] = t.line; n += t.n; ch = true; } });
        if (ch) { h.s.body = lines.join('\n'); ns++; }
      });
      if (!n) return toast('Nothing changed.');
      saveProjects(); render(); open(); toast('Replaced ' + n + ' in ' + ns + ' section' + (ns === 1 ? '' : 's'));
    }
  });
  document.addEventListener('input', function (e) { var t = e.target; if (t.id === 'frq') { fr.q = t.value; results(); } else if (t.id === 'frr') { fr.r = t.value; results(); } });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'frcs') { fr.cs = t.checked; results(); } else if (t.id === 'frww') { fr.ww = t.checked; results(); } else if (t.id === 'frexc') { fr.exc = t.checked; results(); } else if (t.id === 'frscope') { fr.scope = t.value; results(); }
    else if (t.dataset && t.dataset.frsec !== undefined) { [].forEach.call(document.querySelectorAll('[data-frln^="' + t.dataset.frsec + ':"]'), function (c) { c.checked = t.checked; }); }
  });
  document.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && (e.key === 'h' || e.key === 'H') && ui.view === 'project') { e.preventDefault(); open(); } });
  var vp = viewProject;
  viewProject = function () { return vp.apply(this, arguments).replace('<button class="btn sm" data-act="findopen"', '<button class="btn sm" data-act="fropen" title="Find and replace (Ctrl/Cmd+H)">Replace</button><button class="btn sm" data-act="findopen"'); };
})();
