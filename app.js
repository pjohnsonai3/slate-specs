/* ============================================================================
   Slate Specs — an ai3 product  (app.js)
   Architectural specification writer. Same conventions as STEVE: single-file
   HTML, vanilla JS, localStorage (prefix ss1_) + Supabase app_state sync.
   ========================================================================= */
(function () {
  'use strict';
  var esc = SS.esc, $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------------- storage ---------------- */
  var DB = {
    load: function (k, d) { try { var v = localStorage.getItem('ss1_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    save: function (k, v) { try { localStorage.setItem('ss1_' + k, JSON.stringify(v)); } catch (e) { toast('⚠ Could not save locally (storage full?)'); } cloudSchedule(); }
  };
  var projects = DB.load('projects', []);
  var archive = DB.load('archive', []);   /* reference projects: past manuals kept as written, searchable, section-by-section reusable */
  var library = DB.load('library', null);
  var settings = DB.load('settings', { model: 'claude-sonnet-5-5', architect: 'ai3, Inc.' });
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  if (!library) library = {};
  Object.keys(SS.SEED).forEach(function (c) {
    var L = library[c];
    if (!L || (L.status === 'seed' && (L.rev || 0) < SS.SEED[c].rev)) library[c] = clone(SS.SEED[c]);
  });
  DB.save('library', library);
  function saveProjects() { DB.save('projects', projects); }
  function saveArchive() { DB.save('archive', archive); }
  function saveLibrary() { DB.save('library', library); }
  function saveSettings() { DB.save('settings', settings); }

  var ui = { view: 'projects', pid: null, tab: 'sections', code: null, editText: false, notes: false, libCode: null, libQ: '', pickQ: '' };
  var busy = {};

  function proj() { return projects.filter(function (p) { return p.id === ui.pid; })[0]; }
  function curSec() { var p = proj(); return p && p.sections.filter(function (s) { return s.code === ui.code; })[0]; }
  function catTitle(code) { var c = SS.CATALOG.filter(function (x) { return x[0] === code; })[0]; return c ? c[1] : ''; }

  /* ---------------- toast / modal ---------------- */
  var toastT;
  function toast(m, ms) { var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = 'none'; }, ms || 3200); }
  function modal(html, wide) { closeModal(); var d = document.createElement('div'); d.className = 'modal'; d.id = 'modal'; d.innerHTML = '<div class="mbox' + (wide ? ' wide' : '') + '">' + html + '</div>'; d.addEventListener('mousedown', function (e) { if (e.target === d) closeModal(); }); document.body.appendChild(d); return d; }
  function closeModal() { var m = $('#modal'); if (m) m.remove(); }

  /* ---------------- project helpers ---------------- */
  function newSection(code, title) {
    var lib = library[code];
    return { code: code, title: (lib && lib.title) || title || catTitle(code) || code, on: true, body: lib ? lib.body : '', questions: lib ? clone(lib.questions) : [], answers: {}, status: 'draft', libRev: lib ? lib.rev : 0, aiKeys: [] };
  }
  function addSections(p, codes) {
    codes.forEach(function (c) { if (!p.sections.some(function (s) { return s.code === c; })) p.sections.push(newSection(c)); });
    p.sections.sort(function (a, b) { return SS.sortCodes(a.code, b.code); });
  }
  function renderSec(p, s, notes) { return SS.render(s, p, { notes: !!notes }); }
  function projStats(p) {
    var on = p.sections.filter(function (s) { return s.on; }), open = 0, empty = 0, fin = 0;
    on.forEach(function (s) { if (!s.body.trim()) { empty++; return; } open += renderSec(p, s).unresolved; if (s.status === 'final') fin++; });
    return { on: on.length, open: open, empty: empty, fin: fin };
  }

  /* ================= VIEWS ================= */
  function render() {
    var root = $('#app'); var _c = $('.three .col'), _st = _c ? _c.scrollTop : 0;
    var titles = { projects: 'Projects', archive: 'Reference projects', library: 'Master library', settings: 'Settings', help: 'Help' };
    var nav = ['projects', 'archive', 'library', 'settings', 'help'].map(function (v) { return '<button data-act="nav" data-v="' + v + '" class="ni' + (ui.view === v || (v === 'projects' && ui.view === 'project') ? ' on' : '') + '"><span class="dot"></span>' + titles[v] + '</button>'; }).join('');
    var pp = ui.view === 'project' ? proj() : null;
    var ttl = pp ? esc(pp.name || 'Untitled') + (pp.number ? ' <span class="sub">' + esc(pp.number) + '</span>' : '') : titles[ui.view] || '';
    root.innerHTML = '<div class="sb"><div class="logo"><img src="' + (window.__AI3_LOGO || '') + '" alt="ai3"><div class="logo-sub">Slate Specs</div></div><nav>' + nav + '</nav><div class="sb-foot"><div class="thm"><button data-act="theme" data-t="light">Light</button><button data-act="theme" data-t="dark">Dark</button></div><span id="syncpill" class="pill">' + esc(cloud.label) + '</span></div></div><div class="mainc"><div class="topbar"><h1>' + ttl + '</h1></div><div class="main" id="main"></div></div>';
    $('#syncpill').className = 'pill' + (cloud.ok ? ' ok' : '');
    var m = $('#main');
    if (ui.view === 'projects') m.innerHTML = viewProjects();
    else if (ui.view === 'project') { m.style.overflow = 'hidden'; m.innerHTML = viewProject(); afterProject(); }
    else if (ui.view === 'library') m.innerHTML = viewLibrary();
    else if (ui.view === 'archive') m.innerHTML = viewArchive();
    else if (ui.view === 'help') m.innerHTML = viewHelp();
    else m.innerHTML = viewSettings();
    if (ui.view !== 'project') m.style.overflow = 'auto';
    var _n = $('.three .col'); if (_n && _st) _n.scrollTop = _st;
  }

  function viewProjects() {
    var cards = projects.map(function (p) {
      var st = projStats(p), pct = st.on ? Math.round(100 * st.fin / st.on) : 0;
      return '<div class="card" data-act="open" data-id="' + p.id + '"><h3>' + esc(p.name || 'Untitled') + '</h3><div class="meta">' + esc([p.number, p.owner].filter(Boolean).join(' • ')) + '</div><div class="meta" style="margin-top:6px">' + st.on + ' sections • ' + st.open + ' open items' + (st.empty ? ' • ' + st.empty + ' need boilerplate' : '') + '</div><div class="bar"><i style="width:' + pct + '%"></i></div><div class="small muted" style="margin-top:4px">' + pct + '% marked final</div><div style="margin-top:6px"><button class="btn sm" data-act="dupopen" data-id="' + p.id + '">Duplicate</button></div></div>';
    }).join('');
    return '<div class="wrap"><div class="row"><div><h1>Projects</h1><div class="muted">Each project is a specification manual built from the ai3 master library.</div></div><div class="sp"></div><button class="btn pri" data-act="newproj">+ New project</button></div>' + (cards ? '<div class="grid">' + cards + '</div>' : '<div class="empty">No projects yet. Create one and pick a starter set of sections.</div>') + '</div>';
  }

  function projForm(p) {
    p = p || {};
    function f(k, l, ph) { return '<div class="fld"><label>' + l + '</label><input type="text" data-pf="' + k + '" value="' + esc(p[k] || '') + '" placeholder="' + esc(ph || '') + '"></div>'; }
    return '<div class="two">' + f('name', 'Project name', 'River North Wellness Hotel') + f('number', 'Project number') + '<div class="fld"><label>Project type</label><select data-pf="ptype"><option value="">(not set)</option>' + SS.PTYPES.map(function (t) { return '<option value="' + t + '"' + (p.ptype === t ? ' selected' : '') + '>' + esc(SS.PTYPE_LABELS[t]) + '</option>'; }).join('') + '</select></div>' + f('owner', 'Owner') + f('contractor', 'Contractor (if known)') + f('address', 'Street address') + f('cityState', 'City, State', 'Fort Lauderdale, FL') + '</div>' +
      '<div class="two"><div class="fld"><label>Issue phase</label><select data-pf="phase">' + ['', 'Schematic Design', 'Design Development', 'Permit Set', 'Construction Documents', 'Bid Set', 'Issued for Construction', 'Released for Construction'].concat(p.phase && ['Schematic Design', 'Design Development', 'Permit Set', 'Construction Documents', 'Bid Set', 'Issued for Construction', 'Released for Construction'].indexOf(p.phase) < 0 ? [p.phase] : []).map(function (o) { return '<option' + (p.phase === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>' + f('issueDate', 'Issue date', 'December 12, 2026') + '</div>' +
      '<div class="two">' + f('code', 'Governing building code', 'Florida Building Code, Building, 8th Edition (2023)') + f('contractForm', 'Contract form', 'AIA A201-2017') + '</div>' +
      '<div class="two">' + f('architect', 'Architect of record', settings.architect || 'ai3, Inc.') + f('interior', 'Interior designer') + f('structural', 'Structural engineer') + f('cm', 'Construction management') + f('mep', 'MEP engineer') + f('civil', 'Civil engineer') + f('landscape', 'Landscape architect') + '</div>';
  }
  function readForm(root, p) { [].forEach.call(root.querySelectorAll('[data-pf]'), function (el) { p[el.dataset.pf] = el.value.trim(); }); }

  function typeSets() { if (!settings.typeSets) { settings.typeSets = {}; SS.PTYPES.forEach(function (t) { settings.typeSets[t] = (SS.TYPE_SEED[t] || []).slice(); }); saveSettings(); } return settings.typeSets; }
  function newProjectModal() {
    var ts = typeSets();
    var opts = SS.PTYPES.map(function (t) { return '<option value="t:' + t + '">' + esc(SS.PTYPE_LABELS[t]) + ' set (' + (ts[t] || []).length + ' sections)</option>'; }).join('') + SS.STARTERS.map(function (s, i) { return '<option value="s:' + i + '">' + esc(s.name) + ' (' + s.codes.length + ' sections)</option>'; }).join('');
    modal('<h2>New project</h2><div id="npf">' + projForm({ architect: settings.architect }) + '</div><div class="fld"><label>Starter set of sections</label><select id="npstart">' + opts + '</select></div><div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" data-act="createproj">Create</button></div>', true);
  }

  /* ---- project page ---- */
  function viewProject() {
    var p = proj(); if (!p) return '<div class="empty">Project not found.</div>';
    var tabs = [['overview', 'Overview'], ['sections', 'Sections'], ['info', 'Project info & notes'], ['sources', 'Sources'], ['products', 'Products'], ['consultants', 'Consultants' + ((p.consultants || []).length ? ' (' + p.consultants.length + ')' : '')], ['submittals', 'Submittals'], ['coord', 'Coordination' + (openChecks(p).length ? ' (' + openChecks(p).length + ')' : '')], ['export', 'Issue / export']].map(function (t) { return '<button data-act="tab" data-t="' + t[0] + '" class="' + (ui.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
    var head = '<div class="ptop"><div class="tabs">' + tabs + '</div><div class="sp"></div><button class="btn sm" data-act="findopen" title="Search every section (Ctrl/Cmd+K)">Find</button><button class="btn sm" data-act="dupopen" data-id="' + p.id + '">Duplicate</button></div>';
    var body = ui.tab === 'overview' ? viewOverview(p) : ui.tab === 'sections' ? viewSections(p) : ui.tab === 'info' ? viewInfo(p) : ui.tab === 'sources' ? viewSources(p) : ui.tab === 'coord' ? viewCoord(p) : ui.tab === 'products' ? viewProducts(p) : ui.tab === 'consultants' ? viewConsultants(p) : ui.tab === 'submittals' ? viewSubmittals(p) : viewExport(p);
    return '<div style="display:flex;flex-direction:column;height:100%">' + head + '<div style="flex:1;min-height:0;overflow:' + (ui.tab === 'sections' ? 'hidden' : 'auto') + '">' + body + '</div></div>';
  }

  function listHtml(p) {
    var h = '', last = '';
    p.sections.forEach(function (s) {
      var d = SS.divOf(s.code);
      if (d !== last) { h += '<div class="div">Div ' + d + ' – ' + esc(SS.DIVISIONS[d] || '') + '</div>'; last = d; }
      var badge = '';
      if (!s.body.trim()) badge = '<span class="badge n">no text</span>';
      else { var r = renderSec(p, s); badge = s.status === 'final' ? '<span class="badge g">final</span>' : r.unresolved ? '<span class="badge">' + r.unresolved + ' open</span>' : s.status === 'review' ? '<span class="badge b">review</span>' : '<span class="badge g">✓</span>'; }
      h += '<div class="sec ' + (s.code === ui.code ? 'on ' : '') + (s.on ? '' : 'off') + '" data-act="selsec" data-code="' + s.code + '"><input type="checkbox" data-act="toggle" data-code="' + s.code + '" ' + (s.on ? 'checked' : '') + ' title="Include in manual"><span class="c">' + s.code + '</span><span class="t">' + esc(s.title) + '</span>' + badge + '</div>';
    });
    return h || '<div class="empty small">No sections yet. Use “+ Add” to pick from the catalog.</div>';
  }

  function qHtml(s) {
    if (!s.questions.length) return '<div class="muted small">This section has no project-specific questions.</div>';
    return s.questions.map(function (q) {
      var v = s.answers[q.key], ai = (s.aiKeys || []).indexOf(q.key) >= 0, ph = q.default !== undefined ? q.default : '', inp = '';
      if (q.type === 'longtext') inp = '<textarea data-q="' + q.key + '" placeholder="' + esc(ph) + '">' + esc(v || '') + '</textarea>';
      else if (q.type === 'select' || q.type === 'yesno') inp = '<select data-q="' + q.key + '"><option value="">' + (ph !== '' && ph !== undefined ? '(default: ' + esc(ph) + ')' : '— choose —') + '</option>' + (q.options.length ? q.options : ['Yes', 'No']).map(function (o) { return '<option' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      else if (q.type === 'multi') inp = '<div class="chk">' + q.options.map(function (o) { return '<label><input type="checkbox" data-qm="' + q.key + '" value="' + esc(o) + '" ' + ((v || []).indexOf(o) >= 0 ? 'checked' : '') + '>' + esc(o) + '</label>'; }).join('') + '</div>';
      else inp = '<input type="text" data-q="' + q.key + '" value="' + esc(v || '') + '" placeholder="' + esc(ph) + '">';
      return '<div class="q' + (ai ? ' ai' : '') + '"><label>' + esc(q.label) + (ai ? ' <span class="badge b">AI</span>' : '') + '</label>' + inp + (q.help ? '<div class="h">' + esc(q.help) + '</div>' : '') + '</div>';
    }).join('');
  }

  function viewSections(p) {
    var s = curSec();
    var mid;
    if (!s) mid = '<div class="empty">Select a section to answer its project-specific questions.</div>';
    else {
      var lib = library[ocode(s)], stale = lib && lib.rev > (s.libRev || 0) && s.body.trim();
      var head = '<div class="panel"><div class="row"><div><b style="font-size:15px">' + s.code + ' – ' + esc(s.title) + '</b></div><div class="sp"></div><select data-act="status" style="padding:4px 6px;border:1px solid var(--border2);border-radius:6px">' + [['draft', 'Draft'], ['review', 'In review'], ['final', 'Final']].map(function (o) { return '<option value="' + o[0] + '"' + (s.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="row" style="margin-top:10px">' + (!s.body.trim() ? '<button class="btn ai" data-act="gen" data-code="' + s.code + '">✨ Generate boilerplate with AI</button>' : '<button class="btn ai" data-act="fillnotes">✨ Fill answers from notes &amp; uploads</button><button class="btn ai" data-act="review">✨ AI review</button>' + (hasSources(p) ? '<button class="btn ai" data-act="checksec">\u2728 Check vs drawings &amp; finishes</button>' : '')) +
        '<button class="btn sm" data-act="edittext">' + (ui.editText ? 'Hide text editor' : 'Edit section text') + '</button>' +
        (stale ? '<button class="btn sm" data-act="pull">Library updated — pull latest</button><button class="btn sm" data-act="cmplib">Review changes</button>' : '') + '<button class="btn sm" data-act="histundo" title="Put back the text from before the last change">↶ Undo</button><button class="btn sm" data-act="histopen" title="Earlier versions of this section">History</button><button class="btn sm" data-act="refsec" title="Find this section in your past project manuals">Reference</button><button class="btn sm" data-act="buildrefs" title="Write the References article from the standards cited in this section">Build References</button><button class="btn sm" data-act="mfrins">Insert manufacturers</button><button class="btn sm" data-act="renum" title="Change the section number; references follow">Renumber</button>' + '</div></div>';
      var notes = '<div class="panel"><div class="fld" style="margin:0"><label>Notes for this section (used by AI fill)</label><textarea data-snote placeholder="e.g. Guest rooms get 5/8&quot; Type X, level 4. Lobby ceilings level 5.">' + esc(s.notes || '') + '</textarea></div></div>';
      var edit = ui.editText ? '<div class="panel"><h2>Section text</h2><div class="small muted" style="margin-bottom:6px">Project-only copy. Changes here do not touch the library unless you save to it.</div><textarea class="code" data-body>' + esc(s.body) + '</textarea><div class="row" style="margin-top:8px"><button class="btn sm" data-act="tolib">Save to library as ai3 standard</button><button class="btn sm" data-act="reset">Reset to library text</button><button class="btn sm" data-act="cmplib">Compare to library</button></div></div>' : '';
      mid = head + secChecksPanel(p, s) + (s.body.trim() ? '<div class="panel"><h2>Project-specific items</h2>' + qHtml(s) + '</div>' : '<div class="panel muted">This section has no text yet. Generate boilerplate with AI, or open the text editor and paste your own.</div>') + notes + edit;
    }
    return '<div class="three"><div class="col"><div class="lhead"><b>Sections</b><div class="sp"></div><button class="btn sm" data-act="addsec">+ Add</button><button class="btn sm" data-act="reuse" title="Copy sections from another project">Reuse</button><button class="btn sm ai" data-act="genall" title="Generate boilerplate for every included section that has none">✨ Fill gaps</button></div><div id="seclist">' + listHtml(p) + '</div></div><div class="col mid" id="mid">' + mid + '</div><div class="col right"><div class="row" style="margin-bottom:8px"><b>Preview</b><div class="sp"></div><label class="small"><input type="checkbox" data-act="notesToggle" ' + (ui.notes ? 'checked' : '') + '> show notes to specifier</label></div><div class="paper" id="preview"></div></div></div>';
  }

  function viewInfo(p) {
    return '<div class="wrap"><div class="panel"><h2>Project information</h2><div class="muted small" style="margin-bottom:10px">These fill variables across every section (project name, owner, governing code, and so on).</div><div id="pinfo">' + projForm(p) + '</div><div id="typebar">' + typeBar(p) + '</div></div>' +
      '<div class="panel"><h2>Project notes for AI</h2><div class="muted small" style="margin-bottom:6px">Paste the design narrative, meeting notes, owner program, or drawing notes. AI uses this to answer each section’s questions. It only fills blanks and marks what it filled so you can check it.</div><textarea data-pnotes style="width:100%;min-height:200px;padding:9px;border:1px solid var(--border2);border-radius:6px">' + esc(p.notes || '') + '</textarea><div class="row" style="margin-top:10px"><button class="btn ai" data-act="fillall">✨ Apply notes &amp; uploads to all sections</button><button class="btn ai" data-act="genall">✨ Generate missing boilerplate</button></div></div>' +
      '<div class="panel"><h2>Danger zone</h2><button class="btn danger" data-act="delproj">Delete this project</button></div></div>';
  }

  function viewExport0(p) {
    var on = p.sections.filter(function (s) { return s.on; });
    var rows = on.map(function (s) {
      var r = s.body.trim() ? renderSec(p, s) : null;
      return '<tr><td>' + s.code + '</td><td>' + esc(s.title) + '</td><td>' + (r ? (r.unresolved ? '<span class="badge">' + r.unresolved + ' unanswered</span> ' : '') + (r.flags - r.unresolved > 0 ? '<span class="badge n">' + (r.flags - r.unresolved) + ' bracketed</span>' : (!r.unresolved ? '<span class="badge g">clean</span>' : '')) : '<span class="badge n">no text</span>') + '</td><td>' + esc(s.status) + (openChecks(p, s.code).length ? ' <span class="badge" style="background:var(--red-bg);color:var(--red)">' + openChecks(p, s.code).length + ' coordination</span>' : '') + '</td></tr>';
    }).join('');
    return '<div class="wrap"><div class="panel"><h2>Export project manual</h2><div class="row"><button class="btn pri" data-act="docx" data-scope="all">Word (.docx) — full manual</button><button class="btn" data-act="pdf" data-scope="all">PDF — full manual</button><button class="btn" data-act="docx" data-scope="one">Word — selected section only</button><button class="btn" data-act="pdf" data-scope="one">PDF — selected section</button></div><div class="row small" style="margin-top:10px"><label><input type="checkbox" data-act="optNotes" ' + (ui.notes ? 'checked' : '') + '> include notes to specifier (review set)</label></div><div class="small muted" style="margin-top:8px">Unanswered items and anything in [brackets] export highlighted yellow so nothing slips out unnoticed. PDF uses your browser’s print dialog — choose “Save as PDF”.</div></div>' +
      '<div class="panel"><h2>Pre-issue check</h2><table class="tbl"><tr><th>Section</th><th>Title</th><th>Open items</th><th>Status</th></tr>' + (rows || '<tr><td colspan="4" class="muted">No sections included.</td></tr>') + '</table></div></div>';
  }

  function afterProject() { if (ui.tab === 'sections') refreshPreview(); }
  function refreshPreview() {
    var p = proj(), s = curSec(), pv = $('#preview'); if (!pv) return;
    if (!s) { pv.innerHTML = '<div class="muted" style="text-align:center;padding:60px 0">Nothing selected.</div>'; return; }
    if (!s.body.trim()) { pv.innerHTML = '<div class="muted" style="text-align:center;padding:60px 0">No text yet.</div>'; return; }
    pv.innerHTML = SS.sectionHtml(renderSec(p, s, ui.notes), {});
    var l = $('#seclist'); if (l) l.innerHTML = listHtml(p);
  }

  /* ---- library ---- */
  function viewLibrary() {
    var q = (ui.libQ || '').toLowerCase();
    var codes = {}; Object.keys(library).forEach(function (c) { codes[c] = 1; }); SS.CATALOG.forEach(function (c) { codes[c[0]] = 1; });
    var list = Object.keys(codes).sort(SS.sortCodes).filter(function (c) { var t = (library[c] && library[c].title) || catTitle(c); return !q || (c + ' ' + t + ' ' + ((library[c] && library[c].body) || '')).toLowerCase().indexOf(q) >= 0; });
    var lh = list.map(function (c) {
      var L = library[c], t = (L && L.title) || catTitle(c);
      var b = !L || !L.body ? '<span class="badge n">empty</span>' : L.status === 'standard' ? '<span class="badge g">ai3 standard</span>' : L.status === 'ai-draft' ? '<span class="badge">AI draft</span>' : L.status === 'reviewed' ? '<span class="badge b">reviewed</span>' : '<span class="badge b">starter</span>';
      return '<div class="sec ' + (c === ui.libCode ? 'on' : '') + '" data-act="libsel" data-code="' + c + '"><span class="c">' + c + '</span><span class="t">' + esc(t) + '</span>' + b + '</div>';
    }).join('');
    var ed = '<div class="empty">Pick a section to edit its master boilerplate.</div>';
    if (ui.libCode) {
      var c = ui.libCode, L = library[c] || { code: c, title: catTitle(c), body: '', questions: [], status: 'ai-draft', rev: 0 };
      ed = '<div class="panel"><div class="row"><b style="font-size:15px">' + c + '</b><input type="text" data-lib="title" value="' + esc(L.title) + '" style="flex:1;padding:6px 8px;border:1px solid var(--border2);border-radius:6px"><select data-lib="status" style="padding:6px;border:1px solid var(--border2);border-radius:6px">' + [['seed', 'Starter'], ['ai-draft', 'AI draft'], ['reviewed', 'Reviewed'], ['standard', 'ai3 standard']].map(function (o) { return '<option value="' + o[0] + '"' + (L.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="row" style="margin:10px 0"><button class="btn ai" data-act="libgen">✨ ' + (L.body ? 'Regenerate with AI' : 'Generate with AI') + '</button><button class="btn pri" data-act="libsave">Save</button><button class="btn danger sm" data-act="libdel">Delete</button><span class="small muted">rev ' + (L.rev || 0) + ' • saving bumps the revision so projects can pull it</span></div>' +
        '<div class="fld"><label>Section text</label><textarea class="code" data-lib="body">' + esc(L.body) + '</textarea></div><div class="fld"><label>Questions (JSON)</label><textarea class="code" style="min-height:160px" data-lib="questions">' + esc(JSON.stringify(L.questions, null, 1)) + '</textarea></div><details><summary class="small muted" style="cursor:pointer">Section text cheat sheet</summary><div class="cheat">' + esc(CHEAT) + '</div></details></div>';
    }
    return '<div class="wrap" style="max-width:1300px"><div class="row"><div><h1>Master library</h1><div class="muted">ai3’s boilerplate. New projects copy from here; edit once, every future project benefits.</div></div><div class="sp"></div><button class="btn" data-act="libimport">Import from manual…</button> <button class="btn" data-act="libnew">+ Custom section</button></div><div style="display:grid;grid-template-columns:360px 1fr;gap:16px;margin-top:14px"><div class="panel" style="padding:0;max-height:76vh;overflow:auto"><div class="lhead"><input type="text" placeholder="Search sections…" data-libq value="' + esc(ui.libQ || '') + '" style="flex:1;padding:6px 8px;border:1px solid var(--border2);border-radius:6px"></div>' + lh + '</div><div>' + ed + libHistPanel(ui.libCode) + '</div></div></div>';
  }
  var CHEAT = '# GENERAL              PART heading (auto-numbered)\n## SUMMARY             Article heading (1.1, 1.2 ...)\n1: Level-1 paragraph   -> A.\n2: Level-2 paragraph   -> 1.\n3: Level-3 paragraph   -> a.\n4: Level-4 paragraph   -> 1)\nN: Note to specifier   (review sets only)\n\n?(key=Value) anywhere in a line makes it conditional:\n  2: ?(typeX=Yes) Provide Type X board.\n  ?(key)  answered   ?(!key) blank/No   ?(key=A|B) either   ?(a=Yes & b=No) both\nA removed paragraph removes its deeper children too.\n\n{{key}} inserts an answer or a project field.\n[Square brackets] = open decision, highlighted in preview/exports.';

  /* ---- settings ---- */
  function viewSettings() {
    var key = localStorage.getItem('db_apikey_anthropic') || '';
    return '<div class="wrap" style="max-width:720px"><h1>Settings</h1><div class="panel"><h2>AI</h2><div class="fld"><label>Anthropic API key (stored only in this browser; shared with STEVE if it is on the same site)</label><input type="password" id="setkey" value="' + esc(key) + '" placeholder="sk-ant-…"></div><div class="fld"><label>Model</label><input type="text" id="setmodel" value="' + esc(settings.model || '') + '"></div><div class="fld"><label>Drawing pages per AI batch (5\u201340; lower if you hit rate limits)</label><input type="text" id="setbatch" value="' + esc(settings.batchPages || 20) + '"></div><button class="btn pri" data-act="savekey">Save</button></div>' +
      '<div class="panel"><h2>Firm defaults</h2><div class="fld"><label>Architect of record name</label><input type="text" id="setarch" value="' + esc(settings.architect || '') + '"></div><button class="btn" data-act="savearch">Save</button></div>' +
      '<div class="panel"><h2>Cloud &amp; backup</h2><div class="row"><span class="pill ' + (cloud.ok ? 'ok' : '') + '">' + esc(cloud.label) + '</span>' + (cloud.user ? '<button class="btn sm" data-act="signout">Sign out</button>' : '<button class="btn sm" data-act="signin">Sign in to sync</button>') + '</div><div class="row" style="margin-top:12px"><button class="btn" data-act="backup">Download backup (.json)</button>' + (localStorage.getItem('ss1_orphans') ? '<button class="btn" data-act="orphans">Recover projects saved aside</button>' : '') + '<label class="btn">Restore backup<input type="file" accept=".json" data-restore style="display:none"></label></div></div></div>';
  }

  /* ================= AI ================= */
  var GRAMMAR = 'SECTION TEXT FORMAT (one line per paragraph):\n# GENERAL              <- PART heading, one per part (GENERAL, PRODUCTS, EXECUTION), auto-numbered\n## SUMMARY             <- ARTICLE heading, auto-numbered 1.1, 1.2\n1: text                <- paragraph level 1 (A.)\n2: text                <- level 2 (1.)\n3: text                <- level 3 (a.)\nN: text                <- note to specifier\nIf a Part is empty write:  # PRODUCTS (Not Applicable)\nConditions: put ?(key=Value) anywhere in a line to include it only when that question has that answer. Forms: ?(key) ?(!key) ?(key=A|B) ?(a=Yes & b=No). A dropped paragraph drops its deeper children.\nVariables: {{key}} inserts the answer to a question. Sheet references: {{sheet:Wall Type}} becomes the drawing sheet number whose title contains that text. Also available: {{projectName}} {{owner}} {{architect}} {{governingCode}} {{address}} {{cityState}}.\nQUESTION SCHEMA: {"key":"camelCase","label":"Short question","type":"text|longtext|select|yesno|multi","options":["..."],"default":"optional","help":"optional hint"}';

  function apiKey() { return localStorage.getItem('db_apikey_anthropic') || ''; }
  var aiNote = null;   // optional progress callback used during long jobs
  async function aiFull(prompt, maxTokens) {
    var key = apiKey(); if (!key) throw new Error('No Anthropic API key. Open Settings, paste your key and press Save.');
    for (var attempt = 0; attempt < 5; attempt++) {
      var res;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: settings.model || 'claude-sonnet-5-5', max_tokens: maxTokens || 8000, messages: [{ role: 'user', content: prompt }] }) });
      } catch (e) { throw new Error('Could not reach the Anthropic API (' + (e.message || e) + '). Check your connection, VPN, firewall or ad blocker.'); }
      if (res.ok) { var d = await res.json(); return { text: d.content.map(function (c) { return c.text || ''; }).join('').trim(), stop: d.stop_reason }; }
      var er = {}; try { er = await res.json(); } catch (_) {}
      var msg = (er.error && er.error.message) || ('Anthropic error ' + res.status);
      if ([429, 500, 502, 503, 529].indexOf(res.status) >= 0 && attempt < 4) {
        var ra = +res.headers.get('retry-after'), wait = Math.min(90, ra > 0 ? ra : 5 * Math.pow(2, attempt));
        for (var s = wait; s > 0; s--) { if (aiNote) aiNote((res.status === 429 ? 'Rate limited by the API' : 'API busy (' + res.status + ')') + ' — retrying in ' + s + 's…'); await new Promise(function (r) { setTimeout(r, 1000); }); }
        continue;
      }
      var hint = res.status === 401 ? ' Your API key was rejected — check it in Settings.' : res.status === 404 ? ' The model name may be wrong — check Settings.' : res.status === 413 ? ' The request was too large.' : res.status === 429 ? ' Your API plan’s rate limit is too low for this batch size. Lower “Pages per batch” in Settings and try again.' : '';
      var err = new Error('[' + res.status + '] ' + msg + hint); err.status = res.status; throw err;
    }
  }
  async function ai(prompt, maxTokens) { return (await aiFull(prompt, maxTokens)).text; }
  function parseJson(t) { var a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < 0) throw new Error('AI did not return JSON'); return JSON.parse(t.slice(a, b + 1)); }
  function cleanQuestions(qs) {
    return (Array.isArray(qs) ? qs : []).filter(function (q) { return q && q.key && q.label; }).map(function (q) {
      var t = ['text', 'longtext', 'select', 'yesno', 'multi'].indexOf(q.type) >= 0 ? q.type : 'text';
      var o = { key: String(q.key).replace(/[^\w]/g, ''), label: String(q.label), type: t, options: Array.isArray(q.options) ? q.options.map(String) : [], help: q.help ? String(q.help) : '', group: '' };
      if (q.default !== undefined && q.default !== null && q.default !== '') o.default = q.default; return o;
    });
  }
  async function generateSection(code, title) {
    var ex = SS.SEED['09 910'].body.split('\n').slice(0, 22).join('\n');
    var prompt = 'You are a senior architectural specifier writing master specification boilerplate for ai3, Inc., an Atlanta architecture, interior design and FF&E firm that practices in Georgia and Florida on hospitality, mixed-use and commercial projects.\n\nWrite SECTION ' + code + ' – ' + title + ' in CSI SectionFormat (three-part), architect-scope, concise but complete, in the style of a real MasterSpec-quality section.\n\n' + GRAMMAR + '\n\nRULES:\n- Every project-specific decision (products, performance values, finishes, ratings, quantities, optional scope) becomes a QUESTION (4-12 total) and is referenced in the text with {{key}} or ?(condition). Do NOT hard-code decisions the architect has to make.\n- Cite standards (ASTM, ANSI, UL, NFPA, AWS, etc.) only when you are confident of the number and subject; otherwise write [VERIFY: ...] in square brackets.\n- Never invent manufacturer or product names. Use a manufacturer question and a [Manufacturer 1] placeholder list.\n- Use standard CSI article names (SUMMARY, REFERENCES, ACTION SUBMITTALS, INFORMATIONAL SUBMITTALS, QUALITY ASSURANCE, DELIVERY, STORAGE, AND HANDLING, FIELD CONDITIONS, WARRANTY / MANUFACTURERS, MATERIALS, FABRICATION / EXAMINATION, PREPARATION, INSTALLATION, FIELD QUALITY CONTROL, ADJUSTING, CLEANING, PROTECTION).\n- Cross-reference related sections by number and title.\n- Use sparing N: notes to specifier where a decision needs coordination.\n\nFORMAT EXAMPLE (style only, different section):\n' + ex + '\n\nReturn ONLY a JSON object: {"questions":[...],"body":"...text with \\n line breaks..."}';
    var out = parseJson(await ai(prompt, 9000));
    if (typeof out.body !== 'string' || !out.body.trim()) throw new Error('AI returned no section text');
    return { title: title, questions: cleanQuestions(out.questions), body: out.body.replace(/\r/g, '') };
  }
  async function fillAnswers(p, s) {
    var qs = s.questions.filter(function (q) { return s.answers[q.key] === undefined || s.answers[q.key] === '' || (Array.isArray(s.answers[q.key]) && !s.answers[q.key].length); });
    if (!qs.length) return {};
    var notes = [p.notes, s.notes].filter(Boolean).join('\n\n'), dig = digest(p);
    if (!notes.trim() && !dig) throw new Error('Add project notes (Project info tab), section notes, or upload finish specs / drawings (Sources tab) first.');
    var prompt = 'You are helping an architect complete a specification questionnaire for SECTION ' + s.code + ' – ' + s.title + '.\n\nPROJECT: ' + [p.name, p.cityState, p.phase].filter(Boolean).join(', ') + '\n\nNOTES FROM THE DESIGN TEAM:\n' + notes + '\n\nQUESTIONS (JSON):\n' + JSON.stringify(qs.map(function (q) { return { key: q.key, label: q.label, type: q.type, options: q.options, help: q.help }; })) + '\n\nAnswer ONLY questions the notes or extracted information clearly support. Omit any you would have to guess. select/yesno answers must be exactly one of the listed options (yesno: Yes or No); multi answers are arrays of listed options; text answers are brief. Return ONLY JSON: {"answers":{"key":"value"}}';
    var out = parseJson(await ai(prompt, 2500)), res = {};
    Object.keys(out.answers || {}).forEach(function (k) {
      var q = s.questions.filter(function (x) { return x.key === k; })[0]; if (!q) return; var v = out.answers[k];
      if (q.type === 'select' || q.type === 'yesno') { var opts = q.options.length ? q.options : ['Yes', 'No']; var hit = opts.filter(function (o) { return String(o).toLowerCase() === String(v).toLowerCase(); })[0]; if (!hit) return; v = hit; }
      else if (q.type === 'multi') { v = (Array.isArray(v) ? v : [v]).filter(function (x) { return q.options.indexOf(x) >= 0; }); if (!v.length) return; }
      else v = String(v);
      res[k] = v;
    });
    return res;
  }
  function withBusy(key, btn, fn) {
    return async function () {
      if (busy[key]) return; busy[key] = true; if (btn) btn.disabled = true;
      try { await fn(); } catch (e) { toast('⚠ ' + (e && e.message || e), 6000); }
      busy[key] = false; if (btn) btn.disabled = false;
    };
  }
  async function genForSection(p, s) {
    var g = await generateSection(s.code, s.title);
    library[s.code] = { code: s.code, title: s.title, questions: g.questions, body: g.body, status: 'ai-draft', rev: ((library[s.code] && library[s.code].rev) || 0) + 1 };
    s.body = g.body; s.questions = clone(g.questions); s.libRev = library[s.code].rev; saveLibrary(); saveProjects();
  }

  /* ================= EXPORT ================= */
  function renderedFor(p, scope, notes) {
    var list = scope === 'one' ? p.sections.filter(function (s) { return s.code === ui.code; }) : p.sections.filter(function (s) { return s.on; });
    list = list.filter(function (s) { return s.body.trim(); });
    return list.map(function (s) { return renderSec(p, s, notes); });
  }
  function fname(p, scope) { var base = (p.number ? p.number + ' ' : '') + (p.name || 'Project') + (scope === 'one' && ui.code ? ' - ' + ui.code : ' - Project Manual'); return base.replace(/[\\/:*?"<>|]/g, '').trim(); }
  function exportDocx(p, scope) {
    var r = renderedFor(p, scope, ui.notes); if (!r.length) return toast('Nothing to export — included sections have no text yet.');
    var bytes = SS.buildDocx(expProject(p), r, { cover: scope !== 'one' && ui.cover !== false }, window.fflate);
    var url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    var a = document.createElement('a'); a.href = url; a.download = fname(p, scope) + '.docx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Word file ready');
  }
  function exportPdf(p, scope) {
    var r = renderedFor(p, scope, ui.notes); if (!r.length) return toast('Nothing to export — included sections have no text yet.');
    var html = SS.manualHtml(expProject(p), r, { cover: scope !== 'one' && ui.cover !== false });
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0'; document.body.appendChild(f);
    f.onload = function () { var tries = 0; (function go() { var w = f.contentWindow; if (!w.__ready && tries++ < 100) return setTimeout(go, 100); try { w.focus(); w.print(); } catch (e) { toast('Print failed: ' + e.message); } setTimeout(function () { f.remove(); }, 60000); })(); };
    f.srcdoc = html;
  }

  /* ================= CLOUD (Supabase app_state, same project as STEVE) ================= */
  var SB = { url: 'https://qzozlnurhlcqsxcydagb.supabase.co', key: 'sb_publishable_LMbtGgzztGlZtNw-svdAhQ_wwCp9SJY' };
  var cloud = { label: 'Local only', ok: false, user: null, client: null, ready: false, hash: {} };
  var cloudT;
  function hash(v) { return JSON.stringify(v); }
  function projKey(id) { return 'ss_proj_' + id; }
  /* one row per project (like STEVE's per-collection rows), so a save uploads only what changed and the row never holds every project */
  function cloudCollections() { var o = { ss_library: library, ss_settings: { architect: settings.architect, standards: settings.standards || null, typeSets: settings.typeSets || null, firm: settings.firm || null }, ss_idx: projects.map(function (p) { return p.id; }) }; projects.forEach(function (p) { o[projKey(p.id)] = p; }); o.ss_archidx = archive.map(function (x) { return x.id; }); archive.forEach(function (x) { o['ss_arch_' + x.id] = x; }); return o; }
  function cloudSchedule() { if (!cloud || !cloud.client || !cloud.user || !cloud.ready) return; clearTimeout(cloudT); setPill('Saving…', false); cloudT = setTimeout(cloudPush, 1500); }
  function setPill(l, ok) { cloud.label = l; cloud.ok = ok; var p = $('#syncpill'); if (p) { p.textContent = l; p.className = 'pill' + (ok ? ' ok' : ''); } }
  async function cloudPush() {
    var rows = [], c = cloudCollections();
    Object.keys(c).forEach(function (k) { var h = hash(c[k]); if (cloud.hash[k] !== h) rows.push({ key: k, data: c[k], updated_by: cloud.user.id }); });
    var gone = Object.keys(cloud.hash).filter(function (k) { return /^ss_(proj|arch)_/.test(k) && c[k] === undefined; });
    if (!rows.length && !gone.length) return setPill('Cloud synced', true);
    if (rows.length) {
      var r = await cloud.client.from('app_state').upsert(rows, { onConflict: 'key' });
      if (r.error) { console.error(r.error); return setPill('Cloud save failed (saved locally)', false); }
      rows.forEach(function (x) { cloud.hash[x.key] = hash(x.data); });
    }
    if (gone.length) {
      var d = await cloud.client.from('app_state').delete().in('key', gone);
      if (d.error) console.error(d.error); else gone.forEach(function (k) { delete cloud.hash[k]; });
    }
    setPill('Cloud synced', true);
  }
  function cloudFail(msg) {
    cloud.ready = false; setPill('Cloud unavailable', false);
    if ($('#gate')) $('#gate').remove();
    var d = document.createElement('div'); d.className = 'gate'; d.id = 'gate';
    d.innerHTML = '<div class="mbox"><h2 style="font-size:18px">Could not load your projects from the cloud</h2><div class="muted small" style="margin:8px 0 12px">' + esc(msg || '') + '<br><br>Nothing has been changed in the cloud. Slate Specs will not upload anything until the cloud loads, so a stale copy on this device cannot overwrite your saved work.</div><div class="row"><button class="btn pri" data-act="reload">Reload</button><button class="btn" data-act="offline">Work offline (no sync)</button></div></div>';
    document.body.appendChild(d);
  }
  async function cloudPull() {
    var r = await cloud.client.from('app_state').select('key,data').like('key', 'ss%');
    if (r.error) return cloudFail(r.error.message || r.error.code || 'Unknown error');
    var m = {}; (r.data || []).forEach(function (x) { m[x.key] = x.data; });
    var mig = false;
    if (Array.isArray(m.ss_idx)) { var cp = m.ss_idx.map(function (id) { return m[projKey(id)]; }).filter(Boolean); if (cp.length < m.ss_idx.length) return cloudFail('The cloud copy is incomplete (' + cp.length + ' of ' + m.ss_idx.length + ' projects found).'); stashLocal(cp); projects = cp; }
    else if (Array.isArray(m.ss_projects)) { stashLocal(m.ss_projects); projects = m.ss_projects; mig = true; }   /* old single-row format: split on first push */
    if (Array.isArray(m.ss_archidx)) { archive = m.ss_archidx.map(function (id) { return m['ss_arch_' + id]; }).filter(Boolean); localStorage.setItem('ss1_archive', JSON.stringify(archive)); }
    DB.save && localStorage.setItem('ss1_projects', JSON.stringify(projects));
    if (m.ss_library) { Object.keys(SS.SEED).forEach(function (c) { if (!m.ss_library[c]) m.ss_library[c] = clone(SS.SEED[c]); }); library = m.ss_library; localStorage.setItem('ss1_library', JSON.stringify(library)); }
    if (m.ss_settings && m.ss_settings.architect) { settings.architect = m.ss_settings.architect; if (Array.isArray(m.ss_settings.standards)) settings.standards = m.ss_settings.standards; if (m.ss_settings.typeSets) settings.typeSets = m.ss_settings.typeSets; if (m.ss_settings.firm) settings.firm = m.ss_settings.firm; localStorage.setItem('ss1_settings', JSON.stringify(settings)); }
    var c = cloudCollections(); cloud.hash = {};
    Object.keys(m).forEach(function (k) { if (c[k] !== undefined && !(mig && k.indexOf('ss_proj_') === 0)) cloud.hash[k] = hash(c[k]); });
    cloud.ready = true; await cloudPush();
  }
  /* keep one copy of local-only projects before the cloud replaces them */
  function stashLocal(cloudProjects) {
    var ids = {}; cloudProjects.forEach(function (p) { ids[p.id] = 1; });
    var orphans = projects.filter(function (p) { return !ids[p.id] && (p.sections || []).some(function (s) { return s.body && s.body.trim(); }); });
    if (orphans.length) { try { localStorage.setItem('ss1_orphans', JSON.stringify(orphans)); toast(orphans.length + ' project(s) on this device were not in the cloud. Saved aside; see Settings.'); } catch (e) { } }
  }
  async function cloudInit() {
    if (!window.supabase || !window.supabase.createClient) return;
    try { cloud.client = window.supabase.createClient(SB.url, SB.key); } catch (e) { return; }
    var s = await cloud.client.auth.getSession();
    if (s.data && s.data.session) { cloud.user = s.data.session.user; setPill('Syncing…', false); await cloudPull(); render(); }
    else if (!sessionStorage.getItem('ss_offline')) gate();
  }
  function gate() {
    var d = document.createElement('div'); d.className = 'gate'; d.id = 'gate';
    d.innerHTML = '<div class="mbox"><h2 style="font-size:18px">Slate Specs</h2><div class="muted small" style="margin-bottom:12px">Sign in with your ai3 account to sync across devices.</div><div class="fld"><label>Email</label><input type="text" id="gemail"></div><div class="fld"><label>Password</label><input type="password" id="gpass"></div><div id="gerr" class="small" style="color:var(--red);min-height:18px"></div><div class="row"><button class="btn pri" data-act="dosignin">Sign in</button><button class="btn" data-act="offline">Work offline on this device</button></div></div>';
    document.body.appendChild(d);
  }
  async function doSignIn() {
    var r = await cloud.client.auth.signInWithPassword({ email: $('#gemail').value.trim(), password: $('#gpass').value });
    if (r.error) { $('#gerr').textContent = r.error.message; return; }
    cloud.user = r.data.user; $('#gate').remove(); setPill('Syncing…', false); await cloudPull(); render();
  }

  function downloadBackup(name) { var blob = new Blob([JSON.stringify({ projects: projects, archive: archive, library: library, settings: { architect: settings.architect, model: settings.model, standards: settings.standards || null, typeSets: settings.typeSets || null, firm: settings.firm || null } }, null, 1)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && cloud.ready && cloud.client && cloud.user) { clearTimeout(cloudT); cloudPush(); } });

  /* ================= EVENTS ================= */
  var saveT;
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveProjects, 400); }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act, p = proj(), s = curSec();
    if (act === 'toggle' || act === 'status' || act === 'notesToggle' || act === 'optNotes') return;   // handled on change
    if (act === 'nav') { ui.view = el.dataset.v; render(); }
    else if (act === 'theme') { try { localStorage.setItem('ai3_theme', el.dataset.t); } catch (x) {} document.documentElement.setAttribute('data-theme', el.dataset.t === 'dark' ? 'dark' : 'light'); }
    else if (act === 'open') { ui.view = 'project'; ui.pid = el.dataset.id; ui.tab = 'overview'; var pp = proj(); ui.code = pp.sections[0] && pp.sections[0].code; render(); }
    else if (act === 'newproj') newProjectModal();
    else if (act === 'closemodal') closeModal();
    else if (act === 'createproj') {
      var np = { id: SS.uid(), created: Date.now(), sections: [], notes: '' }; readForm($('#npf'), np);
      if (!np.name) return toast('Give the project a name.');
      np.architect = np.architect || settings.architect || 'ai3, Inc.';
      var sv = $('#npstart').value; addSections(np, sv.indexOf('t:') === 0 ? (typeSets()[sv.slice(2)] || []) : SS.STARTERS[+sv.slice(2)].codes); projects.unshift(np); saveProjects(); closeModal();
      ui.view = 'project'; ui.pid = np.id; ui.tab = 'overview'; ui.code = np.sections[0] && np.sections[0].code; render();
    }
    else if (act === 'tab') { ui.tab = el.dataset.t; render(); }
    else if (act === 'selsec') { if (e.target.tagName === 'INPUT') return; ui.code = el.dataset.code; ui.editText = false; render(); }
    else if (act === 'addsec') addPicker();
    else if (act === 'pickadd') { var codes = [].map.call(document.querySelectorAll('[data-pick]:checked'), function (c) { return c.dataset.pick; }); addSections(p, codes); saveProjects(); closeModal(); if (codes.length) ui.code = codes[0]; render(); }
    else if (act === 'edittext') { ui.editText = !ui.editText; render(); }
    else if (act === 'reset') { var L = library[ocode(s)]; if (L && confirm('Replace this project’s text and questions with the library version? Your answers are kept.')) { s.body = L.body; s.questions = clone(L.questions); s.libRev = L.rev; saveProjects(); render(); } }
    else if (act === 'pull') { var L2 = library[ocode(s)]; s.body = L2.body; s.questions = clone(L2.questions); s.libRev = L2.rev; saveProjects(); render(); toast('Pulled latest library text; answers kept.'); }
    else if (act === 'tolib') { libSet(ocode(s), { code: ocode(s), title: s.title, questions: clone(s.questions), body: s.body, status: 'standard', rev: ((library[ocode(s)] && library[ocode(s)].rev) || 0) + 1 }); s.libRev = library[ocode(s)].rev; saveLibrary(); saveProjects(); toast('Saved to the library as ai3 standard.'); render(); }
    else if (act === 'gen') withBusy('gen', el, async function () { toast('Generating ' + s.code + '… about 30–60 seconds', 60000); await genForSection(p, s); toast('Draft generated — review it before issuing.'); render(); })();
    else if (act === 'genall') withBusy('genall', el, async function () {
      var todo = p.sections.filter(function (x) { return x.on && !x.body.trim(); }); if (!todo.length) return toast('Every included section already has text.');
      for (var i = 0; i < todo.length; i++) { toast('Generating ' + todo[i].code + ' (' + (i + 1) + ' of ' + todo.length + ')…', 90000); await genForSection(p, todo[i]); }
      toast('Generated ' + todo.length + ' draft section' + (todo.length > 1 ? 's' : '') + '. Review each one.', 5000); render();
    })();
    else if (act === 'fillnotes') withBusy('fill', el, async function () { var a = await fillAnswers(p, s), n = Object.keys(a).length; Object.keys(a).forEach(function (k) { s.answers[k] = a[k]; if (s.aiKeys.indexOf(k) < 0) s.aiKeys.push(k); }); saveProjects(); toast(n ? 'AI filled ' + n + ' answer' + (n > 1 ? 's' : '') + ' (blue). Check them.' : 'The notes and uploads did not clearly answer any open questions.'); render(); })();
    else if (act === 'fillall') withBusy('fillall', el, async function () {
      var n = 0, list = p.sections.filter(function (x) { return x.on && x.body.trim() && x.questions.length; });
      for (var i = 0; i < list.length; i++) { toast('Reading notes for ' + list[i].code + ' (' + (i + 1) + '/' + list.length + ')…', 60000); try { var a = await fillAnswers(p, list[i]); Object.keys(a).forEach(function (k) { list[i].answers[k] = a[k]; if (list[i].aiKeys.indexOf(k) < 0) list[i].aiKeys.push(k); n++; }); } catch (err) { if (/first\.|API key/.test(err.message)) throw err; } }
      saveProjects(); toast('AI filled ' + n + ' answers across ' + list.length + ' sections. They show in blue.', 5000);
    })();
    else if (act === 'review') withBusy('review', el, async function () {
      toast('Reviewing…', 60000);
      var txt = SS.toText(renderSec(p, s, false));
      var out = await ai('You are a senior architectural specifier doing a QA review of this specification section for ' + (p.name || 'a project') + ' (' + (p.code || 'governing code not stated') + '). List concrete problems only: internal conflicts, missing coordination with other sections, requirements that are unenforceable or vague, wrong or doubtful standard references, and unresolved bracketed items. Be brief: max 10 bullets, each one line, most serious first. If it is clean say so.\n\n' + txt, 1500);
      modal('<h2>AI review — ' + esc(s.code) + '</h2><div style="white-space:pre-wrap;font-size:13px">' + esc(out) + '</div><div class="small muted" style="margin-top:10px">AI review is a second pair of eyes, not a substitute for a licensed professional’s review.</div><div class="mfoot"><button class="btn" data-act="closemodal">Close</button></div>', true); toast('Review ready');
    })();
    else if (act === 'delproj') { if (confirm('Delete this project and all its answers? This cannot be undone.')) { projects = projects.filter(function (x) { return x.id !== p.id; }); saveProjects(); ui.view = 'projects'; render(); } }
    else if (act === 'docx') exportDocx(p, el.dataset.scope);
    else if (act === 'pdf') exportPdf(p, el.dataset.scope);
    else if (act === 'libsel') { ui.libCode = el.dataset.code; render(); }
    else if (act === 'libnew') { var c = prompt('Section number (e.g. 09 300):'); if (!c) return; c = c.trim(); var t = prompt('Section title:'); if (!t) return; library[c] = { code: c, title: t, questions: [], body: '# GENERAL\n## SUMMARY\n1: Section includes:\n# PRODUCTS (Not Applicable)\n# EXECUTION (Not Applicable)', status: 'seed', rev: 1 }; saveLibrary(); ui.libCode = c; render(); }
    else if (act === 'libsave') { var c2 = ui.libCode, L3 = library[c2] || { code: c2, rev: 0 }; var q; try { q = JSON.parse($('[data-lib=questions]').value || '[]'); } catch (er) { return toast('Questions JSON is invalid: ' + er.message, 5000); } L3.title = $('[data-lib=title]').value; L3.status = $('[data-lib=status]').value; if (L3.body && L3.body !== $('[data-lib=body]').value) L3.hist = (L3.hist || []).concat([{ rev: L3.rev || 0, title: L3.title, body: L3.body, at: Date.now() }]).slice(-8); L3.body = $('[data-lib=body]').value; L3.questions = q; L3.rev = (L3.rev || 0) + 1; library[c2] = L3; saveLibrary(); toast('Saved (rev ' + L3.rev + ')'); render(); }
    else if (act === 'libdel') { if (confirm('Delete this library entry? Projects keep their own copies.')) { delete library[ui.libCode]; saveLibrary(); ui.libCode = null; render(); } }
    else if (act === 'libgen') withBusy('libgen', el, async function () { var c3 = ui.libCode, t3 = ($('[data-lib=title]') && $('[data-lib=title]').value) || catTitle(c3); if (library[c3] && library[c3].body && !confirm('Replace the current library text with a new AI draft?')) return; toast('Generating ' + c3 + '…', 60000); var g = await generateSection(c3, t3); libSet(c3, { code: c3, title: t3, questions: g.questions, body: g.body, status: 'ai-draft', rev: ((library[c3] && library[c3].rev) || 0) + 1 }); saveLibrary(); toast('Draft generated — review and edit before marking standard.'); render(); })();
    else if (act === 'savekey') { localStorage.setItem('db_apikey_anthropic', $('#setkey').value.trim()); settings.model = $('#setmodel').value.trim() || 'claude-sonnet-5-5'; settings.batchPages = Math.max(5, Math.min(40, parseInt($('#setbatch').value, 10) || 20)); saveSettings(); toast('Saved'); }
    else if (act === 'savearch') { settings.architect = $('#setarch').value.trim() || 'ai3, Inc.'; saveSettings(); toast('Saved'); }
    else if (act === 'backup') downloadBackup('slate-specs-backup');
    else if (act === 'reload') location.reload();
    else if (act === 'orphans') { try { var os = JSON.parse(localStorage.getItem('ss1_orphans') || '[]'); os.forEach(function (o) { o.id = SS.uid(); o.name = (o.name || 'Untitled') + ' (recovered)'; projects.push(o); }); localStorage.removeItem('ss1_orphans'); saveProjects(); render(); toast('Recovered ' + os.length + ' project(s)'); } catch (er) { toast('Could not recover'); } }
    else if (act === 'signin') { if (!cloud.client) return toast('Cloud library did not load.'); gate(); }
    else if (act === 'signout') { cloud.client.auth.signOut().then(function () { cloud.user = null; cloud.ready = false; setPill('Local only', false); render(); }); }
    else if (act === 'dosignin') doSignIn();
    else if (act === 'offline') { sessionStorage.setItem('ss_offline', '1'); $('#gate').remove(); }
  });

  function addPicker() {
    var p = proj(), have = {}; p.sections.forEach(function (s) { have[s.code] = 1; });
    var codes = {}; Object.keys(library).forEach(function (c) { codes[c] = 1; }); SS.CATALOG.forEach(function (c) { codes[c[0]] = 1; });
    var rows = Object.keys(codes).sort(SS.sortCodes).filter(function (c) { return !have[c]; }).map(function (c) { var t = (library[c] && library[c].title) || catTitle(c); return '<label class="sec" data-t="' + esc((c + ' ' + t).toLowerCase()) + '"><input type="checkbox" data-pick="' + c + '"><span class="c">' + c + '</span><span class="t">' + esc(t) + '</span>' + (library[c] && library[c].body ? '<span class="badge b">has text</span>' : '<span class="badge n">AI will draft</span>') + '</label>'; }).join('');
    modal('<h2>Add sections</h2><input type="text" id="pickq" placeholder="Filter…" style="width:100%;padding:7px 9px;border:1px solid var(--border2);border-radius:6px;margin-bottom:8px"><div style="max-height:52vh;overflow:auto;border:1px solid var(--border);border-radius:8px" id="picklist">' + (rows || '<div class="empty">Every catalog section is already in this project. Add custom sections in the Library tab.</div>') + '</div><div class="mfoot"><button class="btn" data-act="closemodal">Cancel</button><button class="btn pri" data-act="pickadd">Add selected</button></div>', true);
    $('#pickq').addEventListener('input', function () { var q = this.value.toLowerCase(); [].forEach.call(document.querySelectorAll('#picklist .sec'), function (r) { r.style.display = r.dataset.t.indexOf(q) >= 0 ? '' : 'none'; }); });
  }

  document.addEventListener('input', function (e) {
    var t = e.target, p = proj(), s = curSec();
    if (t.dataset.q && s) { s.answers[t.dataset.q] = t.value; var i = s.aiKeys.indexOf(t.dataset.q); if (i >= 0) { s.aiKeys.splice(i, 1); t.closest('.q').classList.remove('ai'); } saveSoon(); refreshPreview(); }
    else if (t.dataset.body !== undefined && s) { s.body = t.value; ui.typing = true; saveSoon(); refreshPreview(); }
    else if (t.dataset.snote !== undefined && s) { s.notes = t.value; saveSoon(); }
    else if (t.dataset.pnotes !== undefined && p) { p.notes = t.value; saveSoon(); }
    else if (t.dataset.pf && p && ui.tab === 'info') { p[t.dataset.pf] = t.value.trim(); saveSoon(); }
    else if (t.dataset.libq !== undefined) { ui.libQ = t.value; var pos = t.selectionStart; render(); var n = $('[data-libq]'); n.focus(); n.setSelectionRange(pos, pos); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, p = proj(), s = curSec();
    if (t.dataset.qm && s) { var cur = s.answers[t.dataset.qm] || []; cur = cur.filter(function (x) { return x !== t.value; }); if (t.checked) cur.push(t.value); s.answers[t.dataset.qm] = cur; saveSoon(); refreshPreview(); }
    else if (t.dataset.act === 'toggle') { var sec = p.sections.filter(function (x) { return x.code === t.dataset.code; })[0]; sec.on = t.checked; saveProjects(); refreshPreview(); }
    else if (t.dataset.act === 'status' && s) { s.status = t.value; saveProjects(); refreshPreview(); }
    else if (t.dataset.act === 'notesToggle' || t.dataset.act === 'optNotes') { ui.notes = t.checked; if (ui.tab === 'sections') refreshPreview(); }
    else if (t.dataset.restore !== undefined && t.files[0]) {
      var r = new FileReader(); r.onload = function () { try { var d = JSON.parse(r.result); if (!d.projects || !d.library) throw new Error('Not a Slate Specs backup'); if (!confirm('Replace everything with this backup? A copy of what is there now will download first.')) return; downloadBackup('slate-specs-before-restore'); projects = d.projects; if (Array.isArray(d.archive)) { archive = d.archive; saveArchive(); } library = d.library; if (d.settings) { if (Array.isArray(d.settings.standards)) settings.standards = d.settings.standards; if (d.settings.typeSets) settings.typeSets = d.settings.typeSets; if (d.settings.firm) settings.firm = d.settings.firm; saveSettings(); } saveProjects(); saveLibrary(); toast('Restored'); render(); } catch (er) { toast('⚠ ' + er.message); } }; r.readAsText(t.files[0]);
    }
  });

/*__SOURCES__*/
/*__EXTRAS__*/

  window.addEventListener('beforeunload', function () { saveProjects(); });
  render();
  cloudInit();
  window.__SS_DEBUG = { get projects() { return projects; }, get library() { return library; }, ui: ui };
})();
