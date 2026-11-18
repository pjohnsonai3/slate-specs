/* ============================================================================
   Slate Specs — Spec engine  (engine.js)
   Pure logic, no DOM. Shared by the preview, PDF and DOCX paths so all three
   always say exactly the same thing.

   SECTION BODY LANGUAGE (one line per paragraph — easy to type, easy for AI):
     # GENERAL                      PART heading  (auto-numbered PART 1, 2, 3)
     ## SUMMARY                     ARTICLE heading (auto-numbered 1.1, 1.2 …)
     1: Section Includes:           paragraph level 1  → A.
     2: Taped joints.               paragraph level 2  → 1.
     3: Level 4 finish.             paragraph level 3  → a.
     4: Detail.                     paragraph level 4  → 1)
     N: Coordinate with …           Note to Specifier (review sets only)
   Any line may carry a condition, anywhere:   2: ?(fireRated=Yes) Provide Type X.
     key            true when answered (not blank / not "No")
     !key           true when blank or "No"
     key=Value      equals (several allowed:  key=A|B)      key!=Value
     a=Yes & b=No   all must hold
   A false condition removes the line AND every deeper line under it.
   Variables:  {{key}}  — answer, else project field, else shown as [Label].
   Sheet refs: {{sheet:Wall Type}} → "Sheet A-601" from the project's drawing index.
   Anything in [square brackets] is a decision still open, and is highlighted.
   ========================================================================= */
(function (root) {
  'use strict';
  var SS = root.SS = root.SS || {};

  SS.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  SS.uid = function () { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  /* ---------- parsing ---------- */
  var COND_RE = /^\?\(([^)]*)\)\s*/;
  var ANY_RE = /\s*\?\(([^)]*)\)\s*/;
  function takeCond(s) { var m = ANY_RE.exec(s); if (!m) return [s, '']; return [(s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(), m[1]]; }

  SS.parseBody = function (text) {
    var parts = [], part = null, art = null;
    function needPart() { if (!part) { part = { title: '', articles: [] }; parts.push(part); } }
    function needArt() { needPart(); if (!art) { art = { title: '', cond: '', paras: [] }; part.articles.push(art); } }
    String(text || '').split(/\r?\n/).forEach(function (raw, idx) {
      var line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;
      var m;
      if ((m = /^#\s+(.*)$/.exec(line)) && line.charAt(1) !== '#') {
        part = { title: m[1].trim(), articles: [], src: idx }; parts.push(part); art = null; return;
      }
      if ((m = /^##\s+(.*)$/.exec(line))) {
        needPart();
        var t = m[1].trim(), cond = '';
        var tc = takeCond(t); t = tc[0]; cond = tc[1];
        art = { title: t, cond: cond, paras: [], src: idx }; part.articles.push(art); return;
      }
      if ((m = /^([1-4NnS]):\s?(.*)$/.exec(line))) {
        needArt();
        var body = m[2], c = '';
        var bc = takeCond(body); body = bc[0]; c = bc[1];
        var k = m[1].toUpperCase();
        art.paras.push({ l: /\d/.test(k) ? +k : 0, note: k === 'N', t: body, cond: c, src: idx, cont: [] });
        return;
      }
      // continuation of previous paragraph (wrapped line)
      if (art && art.paras.length) { var lp = art.paras[art.paras.length - 1]; lp.t += ' ' + line.trim(); lp.cont.push(idx); }
    });
    return parts;
  };

  /* ---------- conditions & values ---------- */
  function isTruthy(v) {
    if (Array.isArray(v)) return v.length > 0;
    v = String(v == null ? '' : v).trim();
    return v !== '' && v.toLowerCase() !== 'no' && v.toLowerCase() !== 'none';
  }
  function valOf(ctx, key) {
    var a = ctx.answers || {};
    if (a[key] !== undefined && a[key] !== '' && !(Array.isArray(a[key]) && !a[key].length)) return a[key];
    var q = ctx.qmap[key];
    if (q && q.default !== undefined && q.default !== '' && !(key in a && a[key] === '')) return q.default;
    if (ctx.vars && ctx.vars[key] !== undefined) return ctx.vars[key];
    return '';
  }
  function hasVal(v, want) {
    var opts = want.split('|').map(function (s) { return s.trim().toLowerCase(); });
    var arr = Array.isArray(v) ? v : [v];
    return arr.some(function (x) { return opts.indexOf(String(x).trim().toLowerCase()) >= 0; });
  }
  SS.evalCond = function (expr, ctx) {
    if (!expr || !expr.trim()) return true;
    return expr.split('&').every(function (term) {
      term = term.trim(); if (!term) return true;
      var m;
      if ((m = /^([\w.]+)\s*!=\s*(.+)$/.exec(term))) return !hasVal(valOf(ctx, m[1]), m[2]);
      if ((m = /^([\w.]+)\s*=\s*(.+)$/.exec(term))) return hasVal(valOf(ctx, m[1]), m[2]);
      if (term.charAt(0) === '!') return !isTruthy(valOf(ctx, term.slice(1).trim()));
      return isTruthy(valOf(ctx, term));
    });
  };

  /* ---------- text → segments ---------- */
  function fmtVal(v) {
    if (Array.isArray(v)) {
      if (v.length <= 1) return v.join('');
      return v.slice(0, -1).join(', ') + ' and ' + v[v.length - 1];
    }
    return String(v);
  }
  SS.REF_RE = /\b(Sections?) (\d\d \d{3,4})(?: ([\"\u201c])([^\"\u201d]+)([\"\u201d]))?/g;
  SS.segments = function (text, ctx, stats) {
    var out = String(text || '').replace(SS.REF_RE, function (m, w, code, q1, title, q2) {
      if (!ctx.secMap) return m;
      var t = ctx.secMap[code];
      if (!t) { if (stats) (stats.refMissing = stats.refMissing || {})[code] = 1; return m; }
      return w + ' ' + t.code + (title ? ' ' + q1 + t.title + q2 : '');
    });
    out = out.replace(/\{\{\s*sheet:([^}]+)\}\}/gi, function (_, kw) {
      kw = kw.trim(); var k = kw.toLowerCase();
      var hits = (ctx.sheets || []).filter(function (s) { return String(s.title || '').toLowerCase().indexOf(k) >= 0; });
      if (hits.length) { var nos = hits.slice(0, 3).map(function (s) { return s.no; }); return (nos.length > 1 ? 'Sheets ' : 'Sheet ') + nos.join(', '); }
      if (stats) stats.unresolved['sheet:' + kw] = 'Sheet: ' + kw;
      return '[Sheet: ' + kw + ']';
    });
    out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (_, key) {
      var v = valOf(ctx, key);
      if (isTruthy(v) || (typeof v === 'string' && v.trim() !== '')) return fmtVal(v);
      var q = ctx.qmap[key], lab = (q && q.label) || SS.VAR_LABELS[key] || key;
      if (stats) stats.unresolved[key] = lab;
      return '[' + lab + ']';
    });
    var segs = [];
    if (ctx.secMap && SS._csFor !== ctx.secMap) { SS._csFor = ctx.secMap; SS._cs = {}; Object.keys(ctx.secMap).forEach(function (k) { SS._cs[ctx.secMap[k].code] = 1; }); }
    var cs = ctx.secMap ? SS._cs : null;
    function pushPlain(t) {        /* split out resolved "Section NN NNN" references so outputs can link them */
      var re = new RegExp(SS.REF_RE.source, 'g'), last = 0, m, hit = false;
      while (cs && (m = re.exec(t))) {
        if (!cs[m[2]]) continue; hit = true;
        if (m.index > last) segs.push({ t: t.slice(last, m.index), fl: false });
        segs.push({ t: m[0], fl: false, ref: m[2] }); last = m.index + m[0].length;
      }
      if (!hit) return segs.push({ t: t, fl: false });
      if (last < t.length) segs.push({ t: t.slice(last), fl: false });
    }
    out.split(/(\[[^\]]*\])/).forEach(function (s) {
      if (!s) return;
      if (/^\[[^\]]*\]$/.test(s)) { segs.push({ t: s, fl: true }); if (stats) stats.flags++; }
      else pushPlain(s);
    });
    return segs;
  };

  /* ---------- numbering ---------- */
  function letters(n, upper) {           // 1→A … 26→Z, 27→AA
    var s = '';
    while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(97 + r) + s; n = Math.floor((n - 1) / 26); }
    return upper ? s.toUpperCase() : s;
  }
  function paraLabel(level, n) {
    return level === 1 ? letters(n, true) + '.' : level === 2 ? n + '.' : level === 3 ? letters(n, false) + '.' : n + ')';
  }

  /* ---------- render a project section ---------- */
  // sec: { code, title, body, questions[], answers{} }   project: info fields
  SS.VAR_LABELS = { projectName: 'Project Name', projectNumber: 'Project Number', owner: 'Owner', architect: 'Architect', address: 'Project Address', cityState: 'City, State', issuePhase: 'Issue Phase', issueDate: 'Issue Date', contractForm: 'Contract Form', governingCode: 'Governing Code', structural: 'Structural Engineer', mep: 'MEP Engineer', civil: 'Civil Engineer', landscape: 'Landscape Architect', contractor: 'Contractor', interiorDesigner: 'Interior Designer', constructionManager: 'Construction Manager', projectType: 'Project Type' };
  SS.projectVars = function (p) {
    p = p || {};
    return {
      projectName: p.name || '', projectNumber: p.number || '', owner: p.owner || '',
      architect: p.architect || 'ai3, Inc.', address: p.address || '', cityState: p.cityState || '',
      issuePhase: p.phase || '', issueDate: p.issueDate || '', contractForm: p.contractForm || '',
      governingCode: p.code || '', structural: p.structural || '', mep: p.mep || '', civil: p.civil || '',
      landscape: p.landscape || '', contractor: p.contractor || '', interiorDesigner: p.interior || '', constructionManager: p.cm || '', projectType: p.ptype || ''
    };
  };

  SS.render = function (sec, project, opts) {
    opts = opts || {};
    var qmap = {}; (sec.questions || []).forEach(function (q) { qmap[q.key] = q; });
    var secMap = null;
    if (project && project.sections) { secMap = {}; project.sections.forEach(function (s) { if (s.on !== false) secMap[s.origin || s.code] = { code: s.code, title: s.title }; }); }
    var ctx = { answers: sec.answers || {}, qmap: qmap, vars: SS.projectVars(project), sheets: (project && project.sheets) || [], secMap: secMap };
    var stats = { unresolved: {}, flags: 0 };
    var parts = SS.parseBody(sec.body);
    var outParts = [], pn = 0;
    parts.forEach(function (pt) {
      pn++;
      var rp = { n: pn, title: pt.title, articles: [], src: pt.src }, an = 0;
      pt.articles.forEach(function (ar) {
        if (!SS.evalCond(ar.cond, ctx)) return;
        var paras = [], counters = [0, 0, 0, 0, 0], skipBelow = -1;
        ar.paras.forEach(function (pa) {
          if (pa.note) { if (opts.notes) paras.push({ l: 0, note: true, label: '', segs: [{ t: '[Note to Specifier: ' + SS.segments(pa.t, ctx, null).map(function (s) { return s.t; }).join('') + ']', fl: false }] }); return; }
          if (skipBelow >= 0) { if (pa.l > skipBelow) return; skipBelow = -1; }
          if (!SS.evalCond(pa.cond, ctx)) { skipBelow = pa.l; return; }
          counters[pa.l]++; for (var i = pa.l + 1; i < 5; i++) counters[i] = 0;
          paras.push({ l: pa.l, note: false, label: paraLabel(pa.l, counters[pa.l]), segs: SS.segments(pa.t, ctx, stats), src: pa.src, cont: pa.cont });
        });
        if (!paras.length && ar.paras.some(function (x) { return !x.note; })) return;   // everything inside was conditioned out
        an++;
        rp.articles.push({ label: pn + '.' + an, title: ar.title, paras: paras, src: ar.src });
      });
      outParts.push(rp);
    });
    return { code: sec.code, title: sec.title, parts: outParts,
             unresolved: Object.keys(stats.unresolved).length, unresolvedKeys: stats.unresolved, flags: stats.flags, refMissing: Object.keys(stats.refMissing || {}) };
  };

  SS.toText = function (r) {
    var L = ['SECTION ' + r.code + ' - ' + r.title.toUpperCase(), ''];
    r.parts.forEach(function (pt) {
      L.push('PART ' + pt.n + ' - ' + pt.title); L.push('');
      pt.articles.forEach(function (ar) {
        L.push(ar.label + '  ' + ar.title);
        ar.paras.forEach(function (pa) {
          L.push(new Array(pa.l + 1).join('    ') + (pa.label ? pa.label + ' ' : '') + pa.segs.map(function (s) { return s.t; }).join(''));
        });
        L.push('');
      });
    });
    L.push('END OF SECTION ' + r.code);
    return L.join('\n');
  };


  /* ---------- diff / redline ---------- */
  SS.diffSeq = function (a, b) {
    var n = a.length, m = b.length, i, j, L = [];
    for (i = 0; i <= n; i++) { L.push(new Array(m + 1)); L[i][m] = 0; }
    for (j = 0; j <= m; j++) L[n][j] = 0;
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push({ t: '=', s: a[i] }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { ops.push({ t: '-', s: a[i++] }); }
      else ops.push({ t: '+', s: b[j++] });
    }
    while (i < n) ops.push({ t: '-', s: a[i++] });
    while (j < m) ops.push({ t: '+', s: b[j++] });
    return ops;
  };
  SS.diffLines = function (a, b) { return SS.diffSeq(String(a || '').split('\n'), String(b || '').split('\n')); };
  SS.diffStats = function (ops) { var s = { add: 0, del: 0 }; ops.forEach(function (o) { if (o.t === '+') s.add++; else if (o.t === '-') s.del++; }); s.changed = s.add + s.del > 0; return s; };
  SS.hash = function (s) { var h = 5381; s = String(s || ''); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  /* word-level markup for a replaced line pair */
  function wordMark(a, b) {
    var ta = a.split(/(\s+)/), tb = b.split(/(\s+)/), ops = SS.diffSeq(ta, tb), del = '', ins = '';
    ops.forEach(function (o) {
      var x = SS.esc(o.s);
      if (o.t === '=') { del += x; ins += x; } else if (o.t === '-') del += '<del>' + x + '</del>'; else ins += '<ins>' + x + '</ins>';
    });
    return [del, ins];
  }
  /* ops -> html lines (changes with `ctx` lines of context). */
  SS.redlineHtml = function (ops, ctx) {
    ctx = ctx == null ? 2 : ctx;
    var keep = new Array(ops.length), i, k;
    for (i = 0; i < ops.length; i++) if (ops[i].t !== '=') for (k = Math.max(0, i - ctx); k <= Math.min(ops.length - 1, i + ctx); k++) keep[k] = true;
    var out = [], gap = false;
    for (i = 0; i < ops.length; i++) {
      if (!keep[i]) { gap = true; continue; }
      if (gap && out.length) out.push('<div class="rl-gap">\u22ef</div>'); gap = false;
      var o = ops[i];
      if (o.t === '=') { out.push('<div class="rl-l">' + (SS.esc(o.s) || '&nbsp;') + '</div>'); continue; }
      // pair a run of deletions with the insertions that follow it
      var dels = [], ins = [];
      while (i < ops.length && ops[i].t === '-') dels.push(ops[i++].s);
      while (i < ops.length && ops[i].t === '+') ins.push(ops[i++].s); i--;
      var pairs = Math.min(dels.length, ins.length);
      for (k = 0; k < pairs; k++) { var w = wordMark(dels[k], ins[k]); out.push('<div class="rl-l rl-d">' + w[0] + '</div>'); out.push('<div class="rl-l rl-i">' + w[1] + '</div>'); }
      for (k = pairs; k < dels.length; k++) out.push('<div class="rl-l rl-d"><del>' + (SS.esc(dels[k]) || '&nbsp;') + '</del></div>');
      for (k = pairs; k < ins.length; k++) out.push('<div class="rl-l rl-i"><ins>' + (SS.esc(ins[k]) || '&nbsp;') + '</ins></div>');
    }
    return out.join('');
  };
  SS.REDLINE_CSS = '.rl-l{white-space:pre-wrap;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:0 6px}.rl-d{background:rgba(217,58,63,.07)}.rl-i{background:rgba(18,154,87,.08)}.rl-l del{color:#c0262b;text-decoration:line-through;background:rgba(217,58,63,.16)}.rl-l ins{color:#0e7a45;text-decoration:underline;background:rgba(18,154,87,.16)}.rl-gap{color:#999;padding:0 6px}';

  /* ---------- submittal register ---------- */
  var SUB_TYPES = [
    ['Shop Drawings', /shop drawing/i, 'Action'], ['Product Data', /product data|manufacturer'?s? (data|literature)|data sheet|cut sheet/i, 'Action'],
    ['Samples', /sample|mock-?up sample|color chart|selection/i, 'Action'], ['Mock-ups', /mock-?up/i, 'Action'],
    ['Delivery, Storage and Handling', /delivery|storage|handling/i, 'Informational'],
    ['Certificates', /certif/i, 'Informational'], ['Test Reports', /test report|test result|testing/i, 'Informational'],
    ['Qualification Data', /qualification|installer|manufacturer qual|resume|experience/i, 'Informational'],
    ['Maintenance Data', /maintenance|operation and|O&M|care and/i, 'Informational'], ['Warranty', /warrant/i, 'Informational'],
    ['Closeout', /closeout|record|as-?built|attic stock|extra stock|spare/i, 'Informational'], ['Schedules', /schedule/i, 'Informational'],
    ['Coordination Drawings', /coordination/i, 'Action']
  ];
  SS.submittalType = function (text, artTitle) {
    var lead = String(text).split(/[:\u2013\u2014]/)[0];
    for (var i = 0; i < SUB_TYPES.length; i++) if (SUB_TYPES[i][1].test(lead)) return SUB_TYPES[i];
    for (i = 0; i < SUB_TYPES.length; i++) if (SUB_TYPES[i][1].test(artTitle || '')) return SUB_TYPES[i];
    return ['Other', null, 'Action'];
  };
  SS.submittals = function (rendered) {
    var out = [];
    rendered.forEach(function (r) {
      var n = 0;
      r.parts.forEach(function (pt) {
        pt.articles.forEach(function (ar) {
          if (!/submittal|warrant|mock-?up|closeout|sample/i.test(ar.title)) return;
          var cur = null;
          ar.paras.forEach(function (pa) {
            if (pa.note) return;
            var txt = pa.segs.map(function (s) { return s.t; }).join('').trim();
            if (pa.l === 1) {
              if (txt.length < 5) { cur = null; return; }
              var t = SS.submittalType(txt, ar.title);
              n++; cur = { code: r.code, sectionTitle: r.title, no: r.code + '-' + (n < 10 ? '0' : '') + n, article: ar.label + ' ' + ar.title, para: pa.label, type: t[0], action: t[2], desc: txt, details: [] };
              out.push(cur);
            } else if (cur && pa.l > 1 && txt) cur.details.push(txt);
          });
        });
      });
    });
    return out;
  };

  /* ---------- division names (ai3 manual style: 1995-era names, Div 1-16 + 26) ---------- */
  SS.DIVISIONS = {
    '00': 'Procurement and Contracting Requirements', '01': 'General Requirements', '02': 'Site Construction',
    '03': 'Concrete', '04': 'Masonry', '05': 'Metals', '06': 'Wood and Plastics',
    '07': 'Thermal and Moisture Protection', '08': 'Doors and Windows', '09': 'Finishes', '10': 'Specialties',
    '11': 'Equipment', '12': 'Furnishings', '13': 'Special Construction', '14': 'Conveying Systems',
    '15': 'Mechanical and Plumbing', '16': 'Electrical', '21': 'Fire Suppression', '22': 'Plumbing',
    '23': 'Heating, Ventilating, and Air Conditioning', '26': 'Lighting', '27': 'Communications',
    '28': 'Electronic Safety and Security', '31': 'Earthwork', '32': 'Exterior Improvements', '33': 'Utilities'
  };
  SS.TOC_DIVS = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','26'];
  SS.DIV_NA = { '15': 'SEE MECHANICAL AND PLUMBING DRAWINGS', '16': 'SEE ELECTRICAL DRAWINGS' };
  /* shared by HTML + DOCX: [{head, rows:[{code,title,note}], na}] */
  SS.tocModel = function (project, rendered) {
    var by = {}; rendered.forEach(function (r) { var d = SS.divOf(r.code); (by[d] = by[d] || []).push(r); });
    var cons = {}; (project.consultants || []).forEach(function (c) { if (c.div) (cons[c.div] = cons[c.div] || []).push(c); });
    var extra = {}; Object.keys(by).concat(Object.keys(cons)).forEach(function (d) { if (SS.TOC_DIVS.indexOf(d) < 0) extra[d] = 1; });
    var divs = SS.TOC_DIVS.concat(Object.keys(extra)).sort();
    return divs.map(function (d) {
      var rows = [];
      if (d === '01') {
        rows.push({ code: '01 001', title: 'TABLE OF CONTENTS', issue: project.issueDate || '', latest: project.issueDate || '' });
        if (project.contractForm) rows.push({ code: '', title: '', note: 'GENERAL CONDITIONS (' + String(project.contractForm).toUpperCase() + ')' });
      }
      (by[d] || []).forEach(function (r) { var sd = (project.secDates || {})[r.code] || {}; rows.push({ code: r.code, title: r.title.toUpperCase(), issue: sd.issue || project.issueDate || '', latest: sd.latest || project.issueDate || '' }); });
      (cons[d] || []).forEach(function (c) { rows.push({ cons: true, num: c.number || '', title: (c.title || '').toUpperCase() + (c.discipline ? ' (' + c.discipline.toUpperCase() + ')' : ''), issue: c.issue || project.issueDate || '', latest: c.issue || project.issueDate || '', pp: c.pages ? c.pages + (c.pages === 1 ? ' page' : ' pages') : '' }); });
      var empty = !(by[d] || []).length && !(cons[d] || []).length && d !== '01';
      return { d: d, head: 'DIVISION ' + parseInt(d, 10) + ' - ' + (SS.DIVISIONS[d] || '').toUpperCase(), rows: empty ? [] : rows, na: empty ? (SS.DIV_NA[d] || 'NOT APPLICABLE') : '' };
    });
  };
  SS.divOf = function (code) { return String(code || '').slice(0, 2); };
  SS.sortCodes = function (a, b) { return a.replace(/\s/g, '') < b.replace(/\s/g, '') ? -1 : a === b ? 0 : 1; };

  /* ---------- HTML (preview + print-to-PDF) ---------- */
  SS.sectionHtml = function (r, opts) {
    opts = opts || {};
    var h = ['<div class="sp-sec">'];
    function segs(a) {
      return a.map(function (s) { return s.fl ? '<mark class="sp-fl">' + SS.esc(s.t) + '</mark>' : s.ref ? '<a class="xr" href="#s-' + s.ref.replace(/\s/g, '') + '">' + SS.esc(s.t) + '</a>' : SS.esc(s.t); }).join('');
    }
    r.parts.forEach(function (pt) {
      h.push('<div class="sp-part">PART ' + pt.n + ' - ' + SS.esc(pt.title) + '</div>');
      pt.articles.forEach(function (ar) {
        h.push('<div class="sp-art"><span class="sp-n">' + ar.label + '</span><span class="sp-at">' + SS.esc(ar.title) + '</span></div>');
        ar.paras.forEach(function (pa) {
          if (pa.note) { h.push('<div class="sp-note">' + segs(pa.segs) + '</div>'); return; }
          h.push('<div class="sp-p l' + pa.l + '"><span class="sp-n">' + SS.esc(pa.label) + '</span><span class="sp-t">' + segs(pa.segs) + '</span></div>');
        });
      });
    });
    h.push('<div class="sp-end">END OF SECTION ' + SS.esc(r.code) + '</div></div>');
    return h.join('');
  };

  SS.PRINT_CSS =
    '@page{size:letter;margin:0}' +
    'body{font:10pt/1.4 "Century Gothic","Questrial",Arial,Helvetica,sans-serif;color:#111;margin:0}' +
    '#src{display:none}' +
    '.pg{width:8.5in;height:11in;box-sizing:border-box;padding:.6in .9in .5in;display:flex;flex-direction:column;page-break-after:always;overflow:hidden;position:relative}' +
    '.pg:last-child{page-break-after:auto}.pgb{flex:1 1 0;min-height:0;overflow:hidden}' +
    '.hd{display:flex;justify-content:space-between;font-size:8.5pt;line-height:1.35;padding-bottom:22pt;flex:none}' +
    '.hd .c{text-align:center;font-weight:700;flex:1}.hd .r{text-align:right;width:2.1in}.hd .l{width:2.1in}' +
    '.ft{text-align:right;font-size:8pt;line-height:1.35;padding-top:10pt;flex:none}' +
    '.sp-part{font-weight:700;margin:18pt 0 8pt;text-align:center}' +
    '.sp-art{font-weight:700;margin:12pt 0 5pt;display:flex}' +
    '.sp-art .sp-n{width:.75in;flex:none}' +
    '.sp-p{display:flex;margin:0 0 5pt}.sp-p .sp-n{flex:none;width:.5in;text-align:left}' +
    '.sp-p.l1{padding-left:.5in}.sp-p.l2{padding-left:1in}.sp-p.l3{padding-left:1.5in}.sp-p.l4{padding-left:2in}.sp-p.l0{padding-left:.25in}' +
    '.sp-note{font-style:italic;color:#555;margin:0 0 4pt .5in}' +
    '.sp-end{text-align:center;font-weight:700;margin-top:22pt}' +
    '.sp-fl{background:#fff2a8;color:inherit;padding:0 1px}' +
    '.cover{position:relative;text-align:center}.cover .t{padding-top:1.1in}.cover h1{font-size:15pt;margin:0 0 4pt}.cover .a{font-size:11pt;line-height:1.5}' +
    '.cover .s{margin-top:.55in;font-size:10pt;line-height:1.5}.cover .s b{display:block}' +
    '.cover .p{position:absolute;left:0;right:0;bottom:.2in;display:grid;grid-template-columns:1fr 1fr;gap:.25in .3in;text-align:left;font-size:9pt;line-height:1.5}' +
    '.cover .p b{display:block;font-size:9.5pt}' +
    'a.xr,.tr a{color:inherit;text-decoration:none}.bm{position:absolute;left:0;top:0;width:6in;height:1px;overflow:hidden;white-space:nowrap;margin:0;padding:0;font-size:6pt;line-height:6pt;color:transparent;font-weight:normal}' +
    '.tr{display:flex;font-size:8.5pt;padding:1.5pt 0}.tr>span{flex:none;padding-right:4pt}.tr .a{width:.85in}.tr .b{flex:1}.tr .c,.tr .d,.tr .e{width:.95in}' +
    '.tr.h{padding-bottom:4pt}.tdv{font-weight:700;font-size:8.5pt;margin:11pt 0 3pt;border-bottom:1px solid #000;padding-bottom:2pt}' +
    '.tna{font-size:8.5pt;padding-top:2pt}.tnt{font-size:8.5pt;padding:3pt 0 4pt 2.3in}';

  /* Pagination runs inside the print document: every page is a fixed Letter sheet, so each section can be
     numbered CODE-1, CODE-2 … and the table of contents can list real page counts. */
  SS.PAGINATE_JS = '(' + function () {
    var D = document.body.dataset;
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function mk(title, code, n) {
      var d = document.createElement('div'); d.className = 'pg';
      d.innerHTML = '<div class="hd"><div class="l"></div><div class="c">' + esc(title) + '<br>' + esc(code) + '</div><div class="r">' + esc(D.status) + '<br>' + esc(D.date) + '</div></div><div class="pgb"></div>' +
        '<div class="ft">' + esc(D.name) + (D.loc ? '<br>' + esc(D.loc) : '') + '<br>' + esc(code.replace(/^SECTION /, '')) + '-' + n + '</div>';
      return d;
    }
    function paginate(blocks, title, code, host) {
      var n = 1, pg = mk(title, code, n), body = pg.querySelector('.pgb'), pages = [pg]; host.appendChild(pg);
      blocks.forEach(function (bl) {
        body.appendChild(bl);
        if (body.scrollHeight > body.clientHeight + 1 && body.children.length > 1) {
          body.removeChild(bl); var mv = [bl];
          while (body.children.length > 1 && /sp-part|sp-art|tdv/.test(body.lastElementChild.className)) mv.unshift(body.removeChild(body.lastElementChild));
          n++; pg = mk(title, code, n); body = pg.querySelector('.pgb'); pages.push(pg); host.appendChild(pg);
          mv.forEach(function (m) { body.appendChild(m); });
        }
      });
      return pages;
    }
    function run() {
      var out = document.getElementById('out'), stage = document.createElement('div'), counts = {}, secPages = [];
      document.body.appendChild(stage);
      [].forEach.call(document.querySelectorAll('#src .sec'), function (s) {
        var blocks = [].slice.call(s.querySelector('.sp-sec').children), code = s.dataset.code;
        var pgs = paginate(blocks, s.dataset.title, 'SECTION ' + code, stage); counts[code] = pgs.length; pgs.div = s.dataset.div;
        pgs[0].insertAdjacentHTML('afterbegin', '<h2 class="bm" id="s-' + code.replace(/\s/g, '') + '">SECTION ' + esc(code) + ' - ' + esc(s.dataset.title) + '</h2>'); secPages.push(pgs);
      });
      var cover = document.querySelector('#src .cover'); if (cover) { var cp = document.createElement('div'); cp.className = 'pg'; cp.appendChild(cover); out.appendChild(cp); }
      var toc = document.getElementById('tocsrc');
      if (toc) {
        [].forEach.call(toc.querySelectorAll('.pp'), function (p) { var c = p.dataset.code; if (counts[c]) p.textContent = c + '-' + counts[c]; });
        var tp = paginate([].slice.call(toc.children), 'TABLE OF CONTENTS', 'SECTION 01 001', out);
        var self = document.querySelector('.pp[data-code="01 001"]'); if (self) self.textContent = '01 001-' + tp.length;
        tp[0].insertAdjacentHTML('afterbegin', '<h1 class="bm" id="s-01001">TABLE OF CONTENTS</h1>');
      }
      var lastDiv = '';
      secPages.forEach(function (pgs) { if (pgs.div && pgs.div !== lastDiv) { lastDiv = pgs.div; pgs[0].insertAdjacentHTML('afterbegin', '<h1 class="bm">' + esc(pgs.div) + '</h1>'); } pgs.forEach(function (p) { out.appendChild(p); }); });
      stage.remove(); document.getElementById('src').remove(); window.__ready = true;
    }
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(run, 50); });
  }.toString() + ')();';

  SS.manualHtml = function (project, rendered, opts) {
    opts = opts || {};
    var E = SS.esc, st = project.phase || '', dt = project.issueDate || '', loc = project.cityState || '';
    var h = ['<!doctype html><html><head><meta charset="utf-8"><title>' + E(project.name || 'Project Manual') + '</title><style>' + SS.PRINT_CSS + '</style></head><body data-name="' + E((project.name || '').toUpperCase()) + '" data-loc="' + E(loc) + '" data-status="' + E(st) + '" data-date="' + E(dt) + '"><div id="out"></div><div id="src">'];
    if (opts.cover !== false) {
      var party = function (k, v) { return v ? '<div><b>' + k + '</b>' + E(v) + '</div>' : ''; };
      h.push('<div class="cover pgcover" style="height:9.9in"><div class="t"><h1>' + E(project.name || '') + '</h1><div class="a">' +
        (project.address ? 'at ' + E(project.address) + '<br>' : '') + (loc ? E(loc) : '') + '</div>' +
        '<div class="s">' + (st ? '<b>' + E(st) + '</b>' : '') + '<b>PROJECT MANUAL</b>' + (project.number ? E(project.numLabel || 'ai3 Project No.') + ' ' + E(project.number) + '<br>' : '') + E(dt) + '</div></div>' +
        '<div class="p">' + party('Owner', project.owner) + party('Architect of Record', project.archLine || project.architect || 'ai3, Inc.') +
        party('Construction Management', project.cm || project.contractor) + party('MEP Engineer', project.mep) +
        party('Structural Engineer', project.structural) + party('Interior Designer', project.interior) + '</div></div>');
      var t = ['<div class="tr h"><span class="a">Division</span><span class="b">Section Title</span><span class="c">Issue Date</span><span class="d">Latest Release</span><span class="e">Pages</span></div>'];
      SS.tocModel(project, rendered).forEach(function (g) {
        t.push('<div class="tdv">' + E(g.head) + '</div>');
        g.rows.forEach(function (r) {
          t.push(r.note ? '<div class="tnt">' + E(r.note) + '</div>' : r.cons ? '<div class="tr"><span class="a">' + E(r.num) + '</span><span class="b">' + E(r.title) + '</span><span class="c">' + E(r.issue || dt) + '</span><span class="d">' + E(r.latest || dt) + '</span><span class="e">' + E(r.pp) + '</span></div>' :
            '<div class="tr"><span class="a"><a href="#s-' + E(r.code.replace(/\s/g, '')) + '">' + E(r.code) + '</a></span><span class="b"><a href="#s-' + E(r.code.replace(/\s/g, '')) + '">' + E(r.title) + '</a></span><span class="c">' + E(r.issue || dt) + '</span><span class="d">' + E(r.latest || dt) + '</span><span class="e pp" data-code="' + E(r.code) + '"></span></div>');
        });
        if (g.na) t.push('<div class="tna">' + E(g.na) + '</div>');
      });
      h.push('<div id="tocsrc">' + t.join('') + '</div>');
    }
    rendered.forEach(function (r) { h.push('<div class="sec" data-code="' + E(r.code) + '" data-div="DIVISION ' + parseInt(SS.divOf(r.code), 10) + ' - ' + E((SS.DIVISIONS[SS.divOf(r.code)] || '').toUpperCase()) + '" data-title="' + E(r.title.toUpperCase()) + '">' + SS.sectionHtml(r, opts) + '</div>'); });
    h.push('</div><script>' + SS.PAGINATE_JS + '<\/script></body></html>');
    return h.join('');
  };

})(typeof window !== 'undefined' ? window : globalThis);
