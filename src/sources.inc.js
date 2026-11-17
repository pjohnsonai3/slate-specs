  /* ================= SOURCES: uploads, extraction, coordination ================= */
  var MAX_BYTES = 18 * 1024 * 1024;
  function batchPages() { return Math.max(5, Math.min(40, parseInt(settings.batchPages, 10) || 20)); }
  var upl = { finish: { msg: '', err: '' }, drawings: { msg: '', err: '' }, hardware: { msg: '', err: '' }, manual: { msg: '', err: '' } };
  function arr(x) { return Array.isArray(x) ? x : []; }
  function str(x) { return x == null ? '' : String(x).trim(); }
  function setProg(kind, msg) { upl[kind].msg = msg || ''; var el = $('#prog-' + kind); if (el) el.textContent = upl[kind].msg; }
  function setErr(kind, err) { upl[kind].err = err || ''; var el = $('#err-' + kind); if (el) { el.textContent = upl[kind].err; el.style.display = upl[kind].err ? 'block' : 'none'; } }
  function b64(u8) { var s = '', CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
  function readBuf(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.onerror = function () { rej(new Error('Could not read ' + file.name)); }; r.readAsArrayBuffer(file); }); }
  function docxText(u8) {
    var z; try { z = window.fflate.unzipSync(u8); } catch (e) { throw new Error('That does not look like a .docx file. Save legacy .doc files as .docx or PDF first.'); }
    var x = z['word/document.xml']; if (!x) throw new Error('No document text found in that Word file.');
    var xml = window.fflate.strFromU8(x).replace(/<w:tab\/>/g, '\t').replace(/<\/w:tc>/g, ' | ').replace(/<\/w:tr>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
    return xml.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* Open a PDF for splitting. If pdf-lib cannot parse it, fall back to sending it whole (if small enough). */
  async function openPdf(u8) {
    var PL = window.PDFLib, src = null, n = 0;
    try { if (!PL) throw new Error('pdf-lib missing'); src = await PL.PDFDocument.load(u8, { ignoreEncryption: true, updateMetadata: false }); n = src.getPageCount(); }
    catch (e) { console.warn('[Slate Specs] pdf-lib could not open this PDF', e); src = null; }
    if (!src) {
      if (u8.length > MAX_BYTES) throw new Error('This PDF could not be opened for splitting and is too big to send whole (' + Math.round(u8.length / 1048576) + ' MB). Re-save it as a new PDF (Print to PDF, or flatten it in Bluebeam/Acrobat) and upload again.');
      return { n: 0, whole: u8, build: null };
    }
    return { n: n, whole: u8, build: async function (a, b) {
      var d = await PL.PDFDocument.create(), idx = []; for (var i = a; i < b; i++) idx.push(i);
      (await d.copyPages(src, idx)).forEach(function (pg) { d.addPage(pg); });
      return d.save();
    } };
  }
  /* Read a PDF in batches. Auto-splits a batch when the reply is cut off or unreadable. Partial results land in acc. */
  async function readPdf(kind, name, pdf, promptFor, acc) {
    acc.results = acc.results || []; acc.skipped = acc.skipped || []; acc.done = 0;
    aiNote = function (m) { setProg(kind, m); };
    function docBlock(bytes) { return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64(bytes) } }; }
    if (!pdf.build) {
      setProg(kind, 'AI is reading ' + name + '… this can take a minute or two');
      var r0 = await aiFull([docBlock(pdf.whole), { type: 'text', text: promptFor(0, 0, 0) }], 16000);
      acc.results.push(parseJson(r0.text)); return;
    }
    var size = batchPages(), total = pdf.n, queue = [];
    for (var a0 = 0; a0 < total; a0 += size) queue.push([a0, Math.min(total, a0 + size)]);
    while (queue.length) {
      var rg = queue.shift(), a = rg[0], b = rg[1];
      var bytes = (a === 0 && b === total && pdf.whole.length <= MAX_BYTES) ? pdf.whole : await pdf.build(a, b);
      if (bytes.length > MAX_BYTES && b - a > 1) { var m1 = a + Math.ceil((b - a) / 2); queue.unshift([m1, b]); queue.unshift([a, m1]); continue; }
      if (bytes.length > 30 * 1024 * 1024) { acc.skipped.push(a + 1); continue; }
      setProg(kind, 'AI is reading ' + (kind === 'drawings' ? 'sheets ' : 'pages ') + (a + 1) + '–' + b + ' of ' + total + ' (' + acc.done + ' done)… about a minute per batch');
      var obj = null, t0 = Date.now(), base = 'AI is reading ' + (kind === 'drawings' ? 'sheets ' : 'pages ') + (a + 1) + '\u2013' + b + ' of ' + total + ' (' + acc.done + ' done)', hold = 0;
      aiNote = function (m) { hold = Date.now(); setProg(kind, m); };
      var tick = setInterval(function () { if (Date.now() - hold > 1500) { var sec = Math.round((Date.now() - t0) / 1000); setProg(kind, base + ' \u2014 ' + Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2) + ' elapsed. A batch usually takes 1\u20134 minutes; keep this tab open.'); } }, 1000);
      try {
        var r = await aiFull([docBlock(bytes), { type: 'text', text: promptFor(a + 1, b, total) }], 16000);
        if (r.stop === 'max_tokens') { var te = new Error('reply truncated'); te.split = true; throw te; }
        obj = parseJson(r.text);
      } catch (e) {
        var recoverable = e.split || e.status === 413 || e instanceof SyntaxError || /did not return JSON/.test(e.message || '');
        if (!recoverable) throw e;
        if (b - a > 1) { var m2 = a + Math.ceil((b - a) / 2); queue.unshift([m2, b]); queue.unshift([a, m2]); continue; }
        acc.skipped.push(a + 1); acc.done += 1; continue;     // a single unreadable page: skip it and say so
      } finally { clearInterval(tick); }
      acc.results.push(obj); acc.done += b - a;
    }
  }

  /* ---- prompts ---- */
  var FIN_PROMPT = 'You are reading finish and product specifications for an architecture and interior design project (finish schedule, finish legend, interior finish specification, door hardware schedule or hardware sets, millwork, plumbing/lighting finishes, etc.). Capture EVERYTHING in it that a specification writer would need, in three buckets.\n\nReturn ONLY JSON: {"finishes":[{"tag":"e.g. P-1","category":"Paint|Wall Covering|Flooring|Base|Tile|Carpet|Ceiling|Casework|Laminate|Countertop|Solid Surface|Hardware|Millwork|Glazing|Other","description":"","manufacturer":"","product":"","color":"","finish":"sheen or texture","size":"","location":"where used"}],"hardwareSets":[{"set":"e.g. HW-1 or Set 3","description":"what the set is for (e.g. Guest room entry, Passage)","doors":"door numbers or locations served","items":[{"qty":"","item":"hinges, lockset, closer, stop, kick plate, threshold, gasketing, exit device, etc.","manufacturer":"","model":"","function":"lock function or series","finish":"e.g. US26D, 626, 630","notes":""}]}],"hardwareNotes":["project-wide door hardware requirements: standard manufacturer, standard finish, keying and key control, cores, ADA/accessibility, fire/smoke labels, power/access control, electrified hardware, acceptable substitutions"],"otherSpecs":[{"topic":"short label e.g. Door Hardware, Millwork, Plumbing Fixtures","text":"any other product or performance requirement stated that does not fit the finish table, kept short but complete"}],"notes":["short project-wide finish notes that matter to technical specifications, max 20"]}\n\nRULES: Door hardware goes in hardwareSets / hardwareNotes (NOT only in finishes). If hardware is listed as a flat schedule instead of sets, make one set per door type or per heading you find. Include only what the document states. Leave unknown fields as empty strings. Never guess a manufacturer, model or finish.';
  function drawPrompt(a, b, n) { return 'You are reading ' + (n ? 'pages ' + a + '\u2013' + b + ' of a ' + n + '-page' : 'a') + ' architectural construction drawing set, to help write the project specifications. Return ONLY JSON:\n{"sheets":[{"no":"A-601","title":"WALL TYPES","disc":"A"}],"projectInfo":{"name":"","number":"","owner":"","address":"","cityState":"","phase":"","issueDate":"","code":"governing building code and edition","architect":"","structural":"","mep":"","civil":"","landscape":"","contractor":"","interior":""},"codeInfo":{"occupancy":"","constructionType":"","sprinklered":"","stories":"","area":"","notes":""},"wallTypes":[{"mark":"","description":"","rating":"","notes":""}],"doorInfo":{"doorTypes":[""],"frameTypes":[""],"ratedDoors":"","hardwareNotes":[""]},"finishLegend":[{"tag":"","category":"","description":"","manufacturer":"","product":"","color":""}],"roomFinishes":[{"room":"","floor":"","base":"","walls":"","ceiling":""}],"generalNotes":["only notes that affect specifications: finishes, ratings, accessibility, products, coordination; max 25"]}\n\nRules: list EVERY sheet in these pages with its number and title from the title block. Include only what is explicitly shown or written; leave anything else as an empty string or empty array. Never guess. Keep roomFinishes to at most 60 rows.'; }

  function isFinKind(k) { return k === 'finish' || k === 'hardware'; }
  var HW_PROMPT = 'THIS FILE IS A DOOR HARDWARE DOCUMENT (hardware schedule, hardware sets, or a door hardware specification). Put everything in "hardwareSets" and "hardwareNotes" (leave "finishes" empty unless it also lists non-hardware finishes). Use "otherSpecs" for door, frame, keying, access-control or ADA requirements that are not hardware items.\n\n' + FIN_PROMPT;
  function promptFor(kind) { return kind === 'hardware' ? HW_PROMPT : FIN_PROMPT; }
  function finSrcs(p) { return srcs(p, 'finish').concat(srcs(p, 'hardware')); }
  function cleanFinishes(o) {
    return {
      finishes: arr(o.finishes).map(function (f) { return { tag: str(f.tag), category: str(f.category), description: str(f.description), manufacturer: str(f.manufacturer), product: str(f.product), color: str(f.color), finish: str(f.finish), size: str(f.size), location: str(f.location) }; }).filter(function (f) { return f.tag || f.description || f.product; }),
      hardwareSets: arr(o.hardwareSets).map(function (h) { return { set: str(h.set), description: str(h.description), doors: str(h.doors), items: arr(h.items).map(function (i) { return { qty: str(i.qty), item: str(i.item), manufacturer: str(i.manufacturer), model: str(i.model), fn: str(i.function), finish: str(i.finish), notes: str(i.notes) }; }).filter(function (i) { return i.item || i.model; }) }; }).filter(function (h) { return h.set || h.items.length; }),
      hardwareNotes: arr(o.hardwareNotes).map(str).filter(Boolean),
      otherSpecs: arr(o.otherSpecs).map(function (x) { return { topic: str(x.topic), text: str(x.text) }; }).filter(function (x) { return x.text; }),
      notes: arr(o.notes).map(str).filter(Boolean)
    };
  }
  function mergeDrawings(list) {
    var out = { sheets: [], projectInfo: {}, codeInfo: {}, wallTypes: [], doorInfo: { doorTypes: [], frameTypes: [], ratedDoors: '', hardwareNotes: [] }, finishLegend: [], roomFinishes: [], generalNotes: [] };
    var seen = {};
    function once(k) { if (seen[k]) return false; seen[k] = 1; return true; }
    list.forEach(function (r) {
      arr(r.sheets).forEach(function (s) { var no = str(s.no); if (no && once('s' + no)) out.sheets.push({ no: no, title: str(s.title), disc: str(s.disc) }); });
      var pi = r.projectInfo || {}; Object.keys(pi).forEach(function (k) { if (!out.projectInfo[k] && str(pi[k])) out.projectInfo[k] = str(pi[k]); });
      var ci = r.codeInfo || {}; Object.keys(ci).forEach(function (k) { if (!out.codeInfo[k] && str(ci[k])) out.codeInfo[k] = str(ci[k]); });
      arr(r.wallTypes).forEach(function (w) { var k = 'w' + str(w.mark) + str(w.description); if (once(k)) out.wallTypes.push({ mark: str(w.mark), description: str(w.description), rating: str(w.rating), notes: str(w.notes) }); });
      var di = r.doorInfo || {};
      arr(di.doorTypes).map(str).filter(Boolean).forEach(function (x) { if (once('d' + x)) out.doorInfo.doorTypes.push(x); });
      arr(di.frameTypes).map(str).filter(Boolean).forEach(function (x) { if (once('f' + x)) out.doorInfo.frameTypes.push(x); });
      arr(di.hardwareNotes).map(str).filter(Boolean).forEach(function (x) { if (once('h' + x)) out.doorInfo.hardwareNotes.push(x); });
      if (!out.doorInfo.ratedDoors && str(di.ratedDoors)) out.doorInfo.ratedDoors = str(di.ratedDoors);
      arr(r.finishLegend).forEach(function (f) { var k = 'l' + str(f.tag) + str(f.description); if (once(k)) out.finishLegend.push({ tag: str(f.tag), category: str(f.category), description: str(f.description), manufacturer: str(f.manufacturer), product: str(f.product), color: str(f.color) }); });
      arr(r.roomFinishes).forEach(function (m) { var k = 'r' + str(m.room); if (once(k)) out.roomFinishes.push({ room: str(m.room), floor: str(m.floor), base: str(m.base), walls: str(m.walls), ceiling: str(m.ceiling) }); });
      arr(r.generalNotes).map(str).filter(Boolean).forEach(function (x) { if (once('n' + x)) out.generalNotes.push(x); });
    });
    out.sheets.sort(function (a, b) { return a.no < b.no ? -1 : a.no > b.no ? 1 : 0; });
    return out;
  }

  /* ---- upload pipeline ---- */
  async function processUpload(kind, files) {
    var p = proj(); if (!p) return;
    p.sources = p.sources || [];
    setErr(kind, '');
    if (!apiKey()) throw new Error('No Anthropic API key. Open Settings, paste your key and press Save, then upload again.');
    for (var fi = 0; fi < files.length; fi++) {
      var file = files[fi], ext = (file.name.split('.').pop() || '').toLowerCase();
      setProg(kind, 'Loading ' + file.name + '…');
      var u8 = await readBuf(file), rec = { id: SS.uid(), kind: kind, name: file.name, added: Date.now(), pages: 0, data: null, skipped: [], partial: false };
      var acc = {}, failure = null;
      try {
        if (isFinKind(kind) && (ext === 'docx' || ext === 'txt' || ext === 'md' || ext === 'csv')) {
          var text = ext === 'docx' ? docxText(u8) : new TextDecoder().decode(u8);
          if (text.length < 20) throw new Error('No readable text found in ' + file.name + '.');
          setProg(kind, 'AI is reading ' + file.name + '…');
          acc.results = [parseJson(await ai(promptFor(kind) + '\n\nDOCUMENT TEXT:\n' + text.slice(0, 150000), 16000))];
        } else if (ext === 'pdf') {
          setProg(kind, 'Opening ' + file.name + ' (' + Math.round(u8.length / 1048576) + ' MB)…');
          var pdf = await openPdf(u8); rec.pages = pdf.n;
          await readPdf(kind, file.name, pdf, kind === 'drawings' ? drawPrompt : function () { return promptFor(kind); }, acc);
        } else throw new Error(file.name + ': ' + (isFinKind(kind) ? 'use PDF, Word (.docx), CSV or text files here.' : 'drawing sets must be PDF.'));
      } catch (e) { failure = e; console.error('[Slate Specs] upload failed', e); }
      aiNote = null;
      var got = arr(acc.results);
      if (got.length) {
        if (isFinKind(kind)) { rec.data = { finishes: [], notes: [], hardwareSets: [], hardwareNotes: [], otherSpecs: [] }; got.forEach(function (o) { var c = cleanFinishes(o); ['finishes', 'notes', 'hardwareSets', 'hardwareNotes', 'otherSpecs'].forEach(function (k) { rec.data[k] = rec.data[k].concat(c[k]); }); }); }
        else rec.data = mergeDrawings(got);
        rec.skipped = arr(acc.skipped); rec.partial = !!failure;
        p.sources.push(rec); syncSheets(p); saveProjects();
      }
      setProg(kind, '');
      if (failure) { var pre = got.length ? 'Stopped part-way — kept what was read so far (' + (acc.done || 0) + ' of ' + (rec.pages || '?') + ' pages). ' : ''; throw new Error(pre + (failure.message || failure)); }
      if (ui.view === 'project' && ui.tab === 'sources') render();
      var empty = kind === 'drawings' ? !arr(rec.data.sheets).length && !arr(rec.data.wallTypes).length && !arr(rec.data.finishLegend).length : !arr(rec.data.finishes).length && !arr(rec.data.hardwareSets).length && !arr(rec.data.otherSpecs).length && !arr(rec.data.hardwareNotes).length;
      if (empty) { setErr(kind, 'The AI read ' + file.name + ' but found nothing it could use. Scanned or very low-resolution pages are the usual cause. Try a vector (not scanned) PDF export.'); continue; }
      if (rec.skipped.length) setErr(kind, 'Read ' + file.name + ' but skipped unreadable pages: ' + rec.skipped.join(', ') + '.');
      if (kind === 'drawings') infoModal(p, rec.data.projectInfo);
      else toast('Read ' + (kind === 'hardware' ? '' : rec.data.finishes.length + ' finish items, ') + arr(rec.data.hardwareSets).length + ' hardware sets from ' + file.name);
    }
  }
  function syncSheets(p) {
    var have = {}; p.sheets = arr(p.sheets); p.sheets.forEach(function (s) { have[s.no] = 1; });
    p.sources.filter(function (s) { return s.kind === 'drawings'; }).forEach(function (s) { arr(s.data && s.data.sheets).forEach(function (x) { if (!have[x.no]) { have[x.no] = 1; p.sheets.push({ no: x.no, title: x.title }); } }); });
    p.sheets.sort(function (a, b) { return a.no < b.no ? -1 : a.no > b.no ? 1 : 0; });
  }
  var INFO_FIELDS = [['name', 'Project name'], ['number', 'Project number'], ['owner', 'Owner'], ['address', 'Address'], ['cityState', 'City, State'], ['phase', 'Issue phase'], ['issueDate', 'Issue date'], ['code', 'Governing code'], ['architect', 'Architect'], ['structural', 'Structural'], ['mep', 'MEP'], ['civil', 'Civil'], ['landscape', 'Landscape'], ['contractor', 'Contractor'], ['interior', 'Interior designer']];
  function infoModal(p, pi) {
    pi = pi || {}; var rows = INFO_FIELDS.filter(function (f) { return str(pi[f[0]]); });
    if (!rows.length) { toast('Drawings read: ' + p.sheets.length + ' sheets indexed. No project info found on the cover.', 5000); return; }
    var h = rows.map(function (f) { var cur = str(p[f[0]]), nv = str(pi[f[0]]), same = cur === nv; return '<tr><td><input type="checkbox" data-infok="' + f[0] + '" ' + (!cur ? 'checked' : '') + (same ? ' disabled' : '') + '></td><td>' + f[1] + '</td><td class="muted">' + esc(cur || '\u2014') + '</td><td>' + esc(nv) + '</td></tr>'; }).join('');
    infoPending = pi;
    modal('<h2>Project info found in the drawings</h2><div class="small muted" style="margin-bottom:8px">Blank fields are pre-checked. Check a row to overwrite what you have. ' + p.sheets.length + ' sheets were added to the sheet index.</div><table class="tbl"><tr><th></th><th>Field</th><th>Now</th><th>From drawings</th></tr>' + h + '</table><div class="mfoot"><button class="btn" data-act="closemodal">Skip</button><button class="btn pri" data-act="applyinfo">Apply checked</button></div>', true);
  }
  var infoPending = null;

  /* ---- digest of everything read, for prompts ---- */
  function srcs(p, kind) { return arr(p.sources).filter(function (s) { return s.kind === kind && s.data; }); }
  function hasSources(p) { return arr(p.sources).length > 0; }
  function digest(p) {
    var o = {}, fin = [];
    var hs = [], hn = [], os = [];
    finSrcs(p).forEach(function (s) { hs = hs.concat(arr(s.data.hardwareSets)); hn = hn.concat(arr(s.data.hardwareNotes)); os = os.concat(arr(s.data.otherSpecs)); });
    if (hs.length || hn.length) o.doorHardwareFromFinishSpecs = { notes: hn.slice(0, 30), sets: hs.slice(0, 60).map(function (h) { return { set: h.set, description: h.description, doors: h.doors, items: h.items.slice(0, 25).map(function (i) { return [i.qty, i.item, i.manufacturer, i.model, i.fn, i.finish, i.notes].map(str).filter(Boolean).join(' | '); }) }; }) };
    if (os.length) o.otherProductRequirements = os.slice(0, 40);
    finSrcs(p).forEach(function (s) { fin = fin.concat(arr(s.data.finishes)); });
    if (fin.length) o.finishSpecifications = fin.slice(0, 150).map(function (f) { return [f.tag, f.category, f.description, f.manufacturer, f.product, f.color, f.finish, f.location].map(str).filter(Boolean).join(' | '); });
    var fn = []; finSrcs(p).forEach(function (s) { fn = fn.concat(arr(s.data.notes)); }); if (fn.length) o.finishNotes = fn.slice(0, 20);
    var dr = srcs(p, 'drawings').map(function (s) { return s.data; });
    if (dr.length) {
      var m = mergeDrawings(dr);
      o.drawings = { sheetIndex: m.sheets.map(function (s) { return s.no + ' ' + s.title; }), codeInfo: m.codeInfo, wallTypes: m.wallTypes, doors: m.doorInfo, finishLegend: m.finishLegend.slice(0, 100), roomFinishes: m.roomFinishes.slice(0, 40), generalNotes: m.generalNotes.slice(0, 40) };
    }
    var t = JSON.stringify(o); return t === '{}' ? '' : t.length > 30000 ? t.slice(0, 30000) : t;
  }

  /* ---- coordination checks ---- */
  function findingsClean(list, code) {
    return arr(list).filter(function (f) { return f && str(f.text); }).slice(0, 10).map(function (f) {
      var sev = ['conflict', 'gap', 'note'].indexOf(f.sev) >= 0 ? f.sev : 'note';
      var add = str(f.addCode); if (add && !SS.CATALOG.some(function (c) { return c[0] === add; }) && !library[add]) add = '';
      return { id: SS.uid(), code: code, sev: sev, text: str(f.text), src: str(f.source), addCode: add, done: false };
    });
  }
  async function checkSection(p, s) {
    var dig = digest(p); if (!dig) throw new Error('Upload finish specs or drawings first (Sources tab).');
    var txt = SS.toText(renderSec(p, s, false));
    var out = parseJson(await ai('You are a senior architectural specifier coordinating a specification section against the drawings and finish specifications for ' + (p.name || 'a project') + '.\n\nSPECIFICATION SECTION:\n' + txt.slice(0, 24000) + '\n\nEXTRACTED FROM THE DRAWINGS AND FINISH SPECIFICATIONS (JSON):\n' + dig + '\n\nList only concrete, verifiable problems between this section and that source information:\n- "conflict": the section says one thing and the drawings or finish specs say another (product, manufacturer, color, sheen, thickness, rating, standard, dimension).\n- "gap": the drawings or finish specs call out something that belongs in this section but the section does not provide for it.\n- "note": the section requires something the drawings or finish specs do not support or show.\nIgnore anything that is not clearly supported by the source information. Maximum 8 findings, most serious first. Cite the source in each (e.g. "Finish legend P-1" or "Sheet A-601 wall types").\nReturn ONLY JSON: {"findings":[{"sev":"conflict|gap|note","text":"one or two sentences","source":""}]}', 2500));
    p.checks = arr(p.checks).filter(function (c) { return c.code !== s.code; }).concat(findingsClean(out.findings, s.code)); saveProjects();
    return p.checks.filter(function (c) { return c.code === s.code; }).length;
  }
  async function checkProject(p) {
    var dig = digest(p); if (!dig) throw new Error('Upload finish specs or drawings first (Sources tab).');
    var have = p.sections.filter(function (s) { return s.on; }).map(function (s) { return s.code + ' ' + s.title; });
    var cat = SS.CATALOG.map(function (c) { return c[0] + ' ' + c[1]; });
    var out = parseJson(await ai('You are a senior architectural specifier checking that a project manual covers what the drawings and finish specifications call for.\n\nSECTIONS INCLUDED IN THE MANUAL:\n' + have.join('\n') + '\n\nCATALOG OF ADDABLE SECTIONS:\n' + cat.join('\n') + '\n\nEXTRACTED FROM THE DRAWINGS AND FINISH SPECIFICATIONS (JSON):\n' + dig + '\n\nFind: (1) materials, finishes, assemblies, doors/hardware or equipment that the drawings or finish specs call for but no included section covers (kind "gap", include "addCode" from the catalog if one fits); (2) included sections with no apparent basis in the drawings or finish specs (kind "note"); (3) inconsistencies inside the source information itself, such as the same tag defined two ways (kind "conflict"). Maximum 12 findings, most serious first, each citing its source.\nReturn ONLY JSON: {"findings":[{"sev":"conflict|gap|note","text":"","source":"","addCode":""}]}', 3000));
    p.checks = arr(p.checks).filter(function (c) { return c.code !== ''; }).concat(findingsClean(out.findings, '')); saveProjects();
  }
  function openChecks(p, code) { return arr(p.checks).filter(function (c) { return !c.done && (code === undefined || c.code === code); }); }

  /* ---- views ---- */
  function srcSummary(s) {
    var d = s.data || {};
    if (isFinKind(s.kind)) return (s.kind === 'hardware' ? '' : arr(d.finishes).length + ' finish items') + (s.kind !== 'hardware' ? '' : (arr(d.hardwareSets).length ? '' : '0 hardware sets')) + (arr(d.hardwareSets).length ? (s.kind === 'hardware' ? '' : ' \u2022 ') + d.hardwareSets.length + ' hardware sets' : '') + (arr(d.otherSpecs).length ? ' \u2022 ' + d.otherSpecs.length + ' other specs' : '') + (s.pages ? ' \u2022 ' + s.pages + ' pages' : '');
    return arr(d.sheets).length + ' sheets \u2022 ' + arr(d.wallTypes).length + ' wall types \u2022 ' + arr(d.finishLegend).length + ' finish tags' + (s.pages ? ' \u2022 ' + s.pages + ' pages' : '') + (s.partial ? ' \u2022 PARTIAL' : '') + (arr(s.skipped).length ? ' \u2022 ' + s.skipped.length + ' pages skipped' : '');
  }
  function tbl(head, rows) { return '<table class="tbl"><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>'; }
  function hwSets(l) { return arr(l); }
  function srcDetail(s) {
    var d = s.data || {}, h = '';
    if (isFinKind(s.kind)) {
      h += tbl(['Tag', 'Category', 'Description', 'Manufacturer / product', 'Color / finish', 'Location'], arr(d.finishes).map(function (f) { return [f.tag, f.category, f.description, [f.manufacturer, f.product].filter(Boolean).join(' \u2014 '), [f.color, f.finish].filter(Boolean).join(' / '), f.location]; }));
      if (arr(d.hardwareSets).length) h += '<h2 style="margin-top:10px">Door hardware sets</h2>' + hwSets(d.hardwareSets).map(function (hs) { return '<div class="small" style="margin:8px 0 2px"><b>' + esc(hs.set) + '</b> ' + esc(hs.description) + (hs.doors ? ' \u2014 doors: ' + esc(hs.doors) : '') + '</div>' + tbl(['Qty', 'Item', 'Manufacturer / model', 'Function', 'Finish', 'Notes'], hs.items.map(function (i) { return [i.qty, i.item, [i.manufacturer, i.model].filter(Boolean).join(' \u2014 '), i.fn, i.finish, i.notes]; })); }).join('');
      if (arr(d.hardwareNotes).length) h += '<div class="small" style="margin-top:6px"><b>Hardware notes:</b><br>' + d.hardwareNotes.map(esc).join('<br>') + '</div>';
      if (arr(d.otherSpecs).length) h += '<h2 style="margin-top:10px">Other product requirements</h2>' + tbl(['Topic', 'Requirement'], d.otherSpecs.map(function (x) { return [x.topic, x.text]; }));
      if (arr(d.notes).length) h += '<div class="small muted" style="margin-top:6px">' + d.notes.map(esc).join('<br>') + '</div>';
    } else {
      if (arr(d.wallTypes).length) h += '<h2 style="margin-top:10px">Wall types</h2>' + tbl(['Mark', 'Description', 'Rating', 'Notes'], d.wallTypes.map(function (w) { return [w.mark, w.description, w.rating, w.notes]; }));
      if (arr(d.finishLegend).length) h += '<h2 style="margin-top:10px">Finish legend</h2>' + tbl(['Tag', 'Category', 'Description', 'Product', 'Color'], d.finishLegend.map(function (f) { return [f.tag, f.category, f.description, [f.manufacturer, f.product].filter(Boolean).join(' \u2014 '), f.color]; }));
      var ci = d.codeInfo || {}, cs = Object.keys(ci).map(function (k) { return k + ': ' + ci[k]; }); if (cs.length) h += '<h2 style="margin-top:10px">Code information</h2><div class="small">' + cs.map(esc).join('<br>') + '</div>';
      if (arr(d.generalNotes).length) h += '<h2 style="margin-top:10px">Notes affecting specs</h2><div class="small">' + d.generalNotes.map(esc).join('<br>') + '</div>';
    }
    return '<details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">View what was read</summary><div style="max-height:360px;overflow:auto;margin-top:6px">' + h + '</div></details>';
  }
  function srcCards(p, kind) {
    var l = srcs(p, kind).map(function (s) { return '<div class="panel" style="margin:8px 0 0;background:var(--surface2)"><div class="row"><b>' + esc(s.name) + '</b><span class="small muted">' + esc(srcSummary(s)) + ' \u2022 ' + new Date(s.added).toLocaleDateString() + '</span><div class="sp"></div><button class="btn sm danger" data-act="srcdel" data-id="' + s.id + '">Remove</button></div>' + srcDetail(s) + '</div>'; }).join('');
    return l || '<div class="small muted" style="margin-top:8px">Nothing uploaded yet.</div>';
  }
  function srcPanel(kind, title, help, accept, multi, dropText, p) {
    return '<div class="panel"><h2>' + title + '</h2><div class="muted small">' + help + '</div>' +
      '<label class="dz" data-dz="' + kind + '"><span class="dzt">\u2728 ' + dropText + '</span><span class="dzs">or click to browse</span><input type="file" ' + (multi ? 'multiple ' : '') + 'accept="' + accept + '" data-upload="' + kind + '" style="display:none"></label>' +
      '<div id="prog-' + kind + '" class="small muted" style="margin-top:8px">' + esc(upl[kind].msg) + '</div>' +
      '<div id="err-' + kind + '" class="panel" style="margin:10px 0 0;background:var(--red-bg);color:var(--red);white-space:pre-wrap;display:' + (upl[kind].err ? 'block' : 'none') + '">' + esc(upl[kind].err) + '</div>' + srcCards(p, kind) + '</div>';
  }
  function viewSources(p) {
    var sheets = arr(p.sheets).map(function (s, i) { return '<tr><td><input type="text" data-sheetno="' + i + '" value="' + esc(s.no) + '" style="width:90px;padding:4px 6px;border:1px solid var(--border2);border-radius:5px"></td><td><input type="text" data-sheettitle="' + i + '" value="' + esc(s.title) + '" style="width:100%;padding:4px 6px;border:1px solid var(--border2);border-radius:5px"></td><td><button class="btn sm" data-act="sheetdel" data-i="' + i + '">\u00d7</button></td></tr>'; }).join('');
    return '<div class="wrap">' +
      srcPanel('finish', 'Finish / FF&E specifications', 'Drop or choose PDF, Word, CSV or text finish schedules and specs. AI reads them into a finish table that feeds the questionnaires (manufacturers, products, colors) and the coordination check. The file itself is not stored, only what was read.', '.pdf,.docx,.txt,.md,.csv', true, 'Drop finish / FF&E specs here', p) +
      srcPanel('hardware', 'Door hardware', 'Drop or choose a hardware schedule or hardware specification (PDF, Word, CSV or text). AI reads every hardware set, item, manufacturer, model and finish, plus keying and project-wide hardware notes. They feed the door hardware sections, and you can insert the sets straight into Section 08 700.', '.pdf,.docx,.txt,.md,.csv', true, 'Drop door hardware schedule or spec here', p) +
      srcPanel('drawings', 'Drawing set', 'Drop or choose the PDF set (best under ~100 sheets). It is read in batches (set the size in Settings), so a full set takes a few minutes and several AI calls. Keep this tab open while it runs. AI pulls the sheet index, wall types, code info, finish legend, door info, room finishes and project info from the cover. The file itself is not stored.', '.pdf', false, 'Drop drawing set (PDF) here', p) +
      '<div class="panel"><h2>Sheet index</h2><div class="muted small" style="margin-bottom:8px">Specs cite sheets with <code>{{sheet:Wall Type}}</code> and this list fills in the sheet number. Edit freely or add sheets by hand.</div><table class="tbl"><tr><th style="width:110px">Sheet</th><th>Title</th><th style="width:40px"></th></tr>' + (sheets || '<tr><td colspan="3" class="muted">No sheets yet.</td></tr>') + '</table><div style="margin-top:8px"><button class="btn sm" data-act="sheetadd">+ Add sheet</button></div></div>' +
      '<div class="panel"><h2>Use what was read</h2><div class="row"><button class="btn ai" data-act="reapplyinfo">Apply project info from drawings</button><button class="btn ai" data-act="fillall">Fill all section answers</button><button class="btn ai" data-act="gotocoord">Run coordination check \u203a</button></div><div class="small muted" style="margin-top:6px">Answers are only filled where blank, and show in blue so you can verify them.</div></div></div>';
  }
  var SEVL = { conflict: ['conflict', 'badge', 'background:var(--red-bg);color:var(--red)'], gap: ['gap', 'badge', ''], note: ['note', 'badge n', ''] };
  function findHtml(p, f, showCode) {
    var sv = SEVL[f.sev] || SEVL.note;
    return '<div class="panel" style="margin:0 0 8px;' + (f.done ? 'opacity:.55' : '') + '"><div class="row"><span class="' + sv[1] + '" style="' + sv[2] + '">' + sv[0] + '</span>' + (showCode && f.code ? '<b class="small">' + esc(f.code) + '</b>' : '') + '<span style="flex:1;min-width:200px">' + esc(f.text) + '</span></div>' + (f.src ? '<div class="small muted" style="margin-top:3px">Source: ' + esc(f.src) + '</div>' : '') + '<div class="row" style="margin-top:6px">' + (showCode && f.code ? '<button class="btn sm" data-act="cojump" data-code="' + f.code + '">Open section</button>' : '') + (f.addCode && !p.sections.some(function (s) { return s.code === f.addCode; }) ? '<button class="btn sm ai" data-act="coadd" data-id="' + f.id + '">+ Add ' + esc(f.addCode) + '</button>' : '') + '<button class="btn sm" data-act="codone" data-id="' + f.id + '">' + (f.done ? 'Reopen' : 'Mark resolved') + '</button></div></div>';
  }
  function viewCoord(p) {
    var all = arr(p.checks), open = all.filter(function (c) { return !c.done; }), done = all.filter(function (c) { return c.done; });
    var order = { conflict: 0, gap: 1, note: 2 };
    open.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    return '<div class="wrap"><div class="row"><div><h1>Coordination</h1><div class="muted">Spec text checked against the drawings and finish specifications you uploaded.</div></div><div class="sp"></div><button class="btn ai" data-act="checkproj">\u2728 Gap check</button><button class="btn ai" data-act="checkall">\u2728 Check every section</button></div><div class="small muted" style="margin:8px 0 14px">' + (hasSources(p) ? 'AI findings are a second pair of eyes. Verify each against the sheet before acting on it.' : 'Upload finish specs or drawings on the Sources tab first.') + '</div>' +
      (open.length ? open.map(function (f) { return findHtml(p, f, true); }).join('') : '<div class="empty">' + (all.length ? 'No open findings.' : 'No checks run yet.') + '</div>') +
      (done.length ? '<h2 style="margin-top:18px">Resolved (' + done.length + ')</h2>' + done.map(function (f) { return findHtml(p, f, true); }).join('') : '') + '</div>';
  }
  function hardwareData(p) { var hs = []; finSrcs(p).forEach(function (x) { hs = hs.concat(arr(x.data.hardwareSets)); }); return hs; }
  function hardwarePanel(p, s) {
    if (!/^08 7/.test(s.code)) return ''; var hs = hardwareData(p); if (!hs.length) return '';
    return '<div class="panel"><h2>Door hardware from your finish specs</h2><div class="small muted">' + hs.length + ' hardware sets were read from the uploaded specifications. Insert them as a Hardware Sets article in this section (it goes in Part 2, and you can edit the text afterwards).</div><div style="margin-top:8px"><button class="btn pri" data-act="inshw">Insert hardware sets into this section</button></div></div>';
  }
  function secChecksPanel(p, s) {
    var l = openChecks(p, s.code), hw = hardwarePanel(p, s); if (!l.length) return hw;
    return hw + '<div class="panel"><h2>Coordination findings (' + l.length + ')</h2>' + l.map(function (f) { return findHtml(p, f, false); }).join('') + '</div>';
  }

  /* ---- events for this feature ---- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act, p = proj(), s = curSec();
    if (act === 'srcdel') { if (confirm('Remove this source? Answers already filled stay as they are.')) { p.sources = p.sources.filter(function (x) { return x.id !== el.dataset.id; }); saveProjects(); render(); } }
    else if (act === 'sheetadd') { p.sheets = arr(p.sheets); p.sheets.push({ no: '', title: '' }); saveProjects(); render(); }
    else if (act === 'sheetdel') { p.sheets.splice(+el.dataset.i, 1); saveProjects(); render(); }
    else if (act === 'reapplyinfo') { var d = srcs(p, 'drawings').map(function (x) { return x.data; }); if (!d.length) return toast('Upload a drawing set first.'); infoModal(p, mergeDrawings(d).projectInfo); }
    else if (act === 'applyinfo') { [].forEach.call(document.querySelectorAll('[data-infok]:checked'), function (c) { p[c.dataset.infok] = str(infoPending[c.dataset.infok]); }); saveProjects(); closeModal(); toast('Project info updated'); render(); }
    else if (act === 'inshw') {
      var hs = hardwareData(p); if (!hs.length || !s) return;
      var L = ['## HARDWARE SETS'];
      hs.forEach(function (h) { L.push('1: ' + [h.set, h.description].filter(Boolean).join(' \u2013 ') + (h.doors ? ' (doors: ' + h.doors + ')' : '') + ':'); h.items.forEach(function (i) { L.push('2: ' + [[i.qty && i.qty + ' \u00d7', i.item].filter(Boolean).join(' '), [i.manufacturer, i.model].filter(Boolean).join(' '), i.fn && 'function ' + i.fn, i.finish && 'finish ' + i.finish, i.notes].filter(Boolean).join(', ')); }); });
      var body = String(s.body || '').replace(/\n## HARDWARE SETS[\s\S]*?(?=\n#|\s*$)/, ''), at = body.search(/\n# EXECUTION/i);
      s.body = at >= 0 ? body.slice(0, at) + '\n' + L.join('\n') + '\n' + body.slice(at) : body + '\n' + L.join('\n');
      saveProjects(); render(); toast('Inserted ' + hs.length + ' hardware sets');
    }
    else if (act === 'gotocoord') { ui.tab = 'coord'; render(); }
    else if (act === 'checksec') withBusy('chk', el, async function () { toast('Checking ' + s.code + '\u2026', 60000); var n = await checkSection(p, s); toast(n ? n + ' finding' + (n > 1 ? 's' : '') + ' \u2014 see below.' : 'No conflicts found for ' + s.code + '.'); render(); })();
    else if (act === 'checkall') withBusy('chkall', el, async function () {
      var list = p.sections.filter(function (x) { return x.on && x.body.trim(); });
      for (var i = 0; i < list.length; i++) { toast('Checking ' + list[i].code + ' (' + (i + 1) + ' of ' + list.length + ')\u2026', 90000); await checkSection(p, list[i]); }
      toast('Checking project gaps\u2026', 60000); await checkProject(p); toast('Coordination check done.'); render();
    })();
    else if (act === 'checkproj') withBusy('chkp', el, async function () { toast('Checking project gaps\u2026', 60000); await checkProject(p); toast('Gap check done.'); render(); })();
    else if (act === 'codone') { var f = p.checks.filter(function (c) { return c.id === el.dataset.id; })[0]; if (f) { f.done = !f.done; saveProjects(); render(); } }
    else if (act === 'cojump') { ui.tab = 'sections'; ui.code = el.dataset.code; ui.editText = false; render(); }
    else if (act === 'coadd') { var g = p.checks.filter(function (c) { return c.id === el.dataset.id; })[0]; if (g) { addSections(p, [g.addCode]); saveProjects(); toast(g.addCode + ' added to the project.'); render(); } }
  });
  document.addEventListener('input', function (e) {
    var t = e.target, p = proj(); if (!p) return;
    if (t.dataset.sheetno !== undefined) { p.sheets[+t.dataset.sheetno].no = t.value.trim(); saveSoon(); }
    else if (t.dataset.sheettitle !== undefined) { p.sheets[+t.dataset.sheettitle].title = t.value.trim(); saveSoon(); }
  });
  function startUpload(kind, files) {
    if (!files.length) return;
    withBusy('up' + kind, null, function () { return processUpload(kind, files).catch(function (err) { setProg(kind, ''); aiNote = null; setErr(kind, String(err && err.message || err)); throw err; }); })();
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (t.dataset.upload === undefined || !t.files.length) return;
    var kind = t.dataset.upload, files = [].slice.call(t.files); t.value = ''; startUpload(kind, files);
  });
  ['dragenter', 'dragover'].forEach(function (ev) { window.addEventListener(ev, function (e) { e.preventDefault(); var z = e.target.closest && e.target.closest('[data-dz]'); [].forEach.call(document.querySelectorAll('.dz.drag'), function (d) { if (d !== z) d.classList.remove('drag'); }); if (z) z.classList.add('drag'); }); });
  window.addEventListener('dragleave', function (e) { if (!e.relatedTarget) [].forEach.call(document.querySelectorAll('.dz.drag'), function (d) { d.classList.remove('drag'); }); });
  window.addEventListener('drop', function (e) {
    e.preventDefault(); [].forEach.call(document.querySelectorAll('.dz.drag'), function (d) { d.classList.remove('drag'); });
    var z = e.target.closest && e.target.closest('[data-dz]'); if (!z) return;
    if (z.dataset.dz === 'manual') { var inp = document.getElementById('impfile'); if (inp && e.dataTransfer.files.length) { inp.files = e.dataTransfer.files; inp.dispatchEvent(new Event('change', { bubbles: true })); } return; }
    startUpload(z.dataset.dz, [].slice.call(e.dataTransfer.files || []));
  });


  /* ================= IMPORT AN EXISTING PROJECT MANUAL INTO THE LIBRARY ================= */
  var imp = { list: [], skipped: [], mode: 'ref', meta: {} };
  function normCode(c) { var d = String(c || '').replace(/[^0-9]/g, ''); return d.length >= 4 ? d.slice(0, 2) + ' ' + d.slice(2) : ''; }
  function manualPrompt(a, b, n) {
    return 'You are converting pages ' + a + '–' + b + ' of ' + n + ' from an architecture firm’s PROJECT MANUAL (CSI-style specification sections) into reusable MASTER BOILERPLATE text.\n\n' + GRAMMAR +
      '\n\nWHAT TO DO:\n- Each page has a running header naming the section (e.g. "SECTION 09 260") and a footer with the project name and page number. Use the header to know which section a page belongs to. Do NOT include headers, footers or page numbers in the text.\n- Transcribe each section’s text FAITHFULLY in the firm’s own words and order. Do not rewrite, improve, shorten or add content. Keep standards numbers, units and article titles exactly.\n- Convert the numbering into the format above: PART headings -> "# GENERAL" etc (no "PART 1 -" prefix), article headings -> "## TITLE" (no "1.1" prefix), lettered paragraphs A. -> "1: ", numbered 1. -> "2: ", lowercase a. -> "3: ". A part that says (Not Applicable) -> "# PRODUCTS (Not Applicable)".\n- Replace anything specific to THIS project (project name, address, owner, named people, room names, sheet numbers, project-specific dates, a specific manufacturer/product the firm chose only for this job) with a [bracketed placeholder] or {{projectName}} / {{owner}} / {{architect}} / {{address}} / {{cityState}}. Keep general manufacturer lists and standards.\n- Tables (abbreviation lists, hardware schedules, door schedules): convert each row to one level-1 line "ABBR: Name". Skip drawing-style schedules that are only project-specific data.\n- SKIP entirely: the cover, table of contents (Section 01 001), the AIA General Conditions (A201) pages and anything that is not a spec section.\n- If a page only contains part of a section, return what is on those pages and set "partial": true. Text that continues an article from the previous page continues as ordinary paragraph lines.\n\nReturn ONLY JSON: {"sections":[{"code":"09 260","title":"Gypsum Wallboard Assemblies","body":"line\\nline...","partial":false}]}';
  }
  function cleanManual(o) {
    return arr(o && o.sections).map(function (x) { return { code: normCode(x.code), title: str(x.title), body: str(x.body).replace(/\r/g, ''), partial: !!x.partial }; }).filter(function (x) { return x.code && x.body; });
  }
  function mergeManual(results) {
    var by = {}, order = [];
    results.forEach(function (r) { cleanManual(r).forEach(function (x) {
      var t = by[x.code]; if (!t) { by[x.code] = t = { code: x.code, title: x.title, body: '' }; order.push(x.code); }
      if (!t.title) t.title = x.title;
      t.body += (t.body ? '\n' : '') + x.body;
    }); });
    return order.map(function (c) { var t = by[c]; t.title = t.title.toLowerCase().replace(/\b[a-z]/g, function (m) { return m.toUpperCase(); }).replace(/\b(And|Of|For|The|In|To|Or)\b(?!^)/g, function (m) { return m.toLowerCase(); }); return t; });
  }
  /* reference mode keeps the manual exactly as written (project names, products, dates); library mode turns project specifics into blanks */
  function refPrompt(a, b, n) {
    return manualPrompt(a, b, n).replace('into reusable MASTER BOILERPLATE text', 'into a faithful REFERENCE copy')
      .replace(/- Replace anything specific to THIS project[\s\S]*?Keep general manufacturer lists and standards\./, '- Keep EVERY project-specific detail exactly as written (names, addresses, owners, room names, sheet numbers, dates, the manufacturers and products chosen). Do NOT use [bracketed placeholders] or {{variables}}; write the real text.');
  }
  function textPrompt(fn) { return fn(0, 0, 0).replace(/pages 0–0 of 0/, 'one part').replace('Each page has a running header naming the section (e.g. "SECTION 09 260") and a footer with the project name and page number. Use the header to know which section a page belongs to.', 'The text has no page headers. Sections start at lines like "SECTION 09 260" and end at "END OF SECTION 09 260".'); }
  function chunkText(t, max) {
    var out = [], cur = '', paras = t.split('\n');
    paras.forEach(function (ln) { if (cur.length + ln.length > max && cur.length > max * 0.5 && /^\s*SECTION \d\d/i.test(ln) || cur.length + ln.length > max * 1.3) { out.push(cur); cur = ''; } cur += ln + '\n'; });
    if (cur.trim()) out.push(cur); return out;
  }
  function impModal() {
    var lib = imp.mode === 'lib';
    modal('<h2>Import a project manual</h2>' +
      '<div class="small" style="margin-bottom:8px"><label style="display:block;margin-bottom:4px"><input type="radio" name="impmode" value="ref" data-impmode' + (lib ? '' : ' checked') + '> <b>Reference project.</b> Keep the manual as written, searchable, and copy sections into any project.</label>' +
      '<label style="display:block"><input type="radio" name="impmode" value="lib" data-impmode' + (lib ? ' checked' : '') + '> <b>Master library.</b> Turn project details into blanks and add the sections as boilerplate.</label></div>' +
      '<div id="impmeta" style="' + (lib ? 'display:none' : '') + '"><div class="two"><div class="fld"><label>Project name</label><input type="text" id="impname" value="' + esc(imp.meta.name || '') + '" placeholder="The Perlant"></div><div class="fld"><label>Project no. / date (optional)</label><input type="text" id="impnum" value="' + esc(imp.meta.number || '') + '" placeholder="e.g. 22-014 • March 2024"></div></div></div>' +
      '<div class="small muted" style="margin-bottom:10px">Upload the finished manual as a PDF or Word file. The AI splits it into sections. About one minute per ' + batchPages() + ' PDF pages, so a 400-page manual takes ~20 minutes. Leave this window open. Nothing is saved until you press the button below.</div>' +
      '<label class="dz" data-dz="manual"><span class="dzt">✨ Drop a project manual (PDF or Word) here</span><span class="dzs">or click to browse</span><input type="file" id="impfile" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-impfile="1" style="display:none"></label><div id="prog-manual" class="small" style="margin:10px 0;color:var(--accent-ink)"></div><div id="err-manual" class="small" style="display:none;color:#a33;margin:6px 0"></div><div id="implist"></div>' +
      '<div class="mfoot"><button class="btn" data-act="closemodal">Close</button><button class="btn pri" data-act="impapply" id="impapply" style="display:none"></button></div>', true);
  }
  function impRender() {
    var el = $('#implist'); if (!el) return; var lib = imp.mode === 'lib';
    el.innerHTML = imp.list.length ? (lib ? '<div class="small" style="margin:8px 0"><label><input type="checkbox" id="impstd"> Mark imported sections as <b>ai3 Standard</b> (otherwise “reviewed”)</label></div>' : '') + '<div style="max-height:46vh;overflow:auto;border:1px solid var(--border);border-radius:8px">' +
      imp.list.map(function (x, i) { var ex = lib && library[x.code] && library[x.code].body;
        return '<label class="sec" style="cursor:pointer"><input type="checkbox" data-impi="' + i + '" checked><span class="c">' + esc(x.code) + '</span><span class="t">' + esc(x.title) + '</span><span class="small muted">' + x.body.split('\n').length + ' lines</span>' + (lib ? (ex ? '<span class="badge n">replaces existing</span>' : '<span class="badge g">new</span>') : '') + '</label>'; }).join('') + '</div>' +
      (imp.skipped.length ? '<div class="small" style="color:#a33;margin-top:6px">Pages the AI could not read: ' + imp.skipped.join(', ') + '</div>' : '') : '';
    var b = $('#impapply'); if (b) { b.style.display = imp.list.length ? '' : 'none'; b.textContent = lib ? 'Add selected to library' : 'Save as reference project'; }
  }
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.impmode !== undefined) { imp.meta = { name: ($('#impname') || {}).value || imp.meta.name, number: ($('#impnum') || {}).value || imp.meta.number }; var keep = imp.list, sk = imp.skipped; imp.mode = t.value; impModal(); imp.list = keep; imp.skipped = sk; impRender(); return; }
    if (!t.dataset || !t.dataset.impfile || !t.files.length) return;
    var f = t.files[0]; t.value = ''; imp.list = []; imp.skipped = []; impRender(); setErr('manual', '');
    if (!imp.meta.name) { imp.meta.name = f.name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/project manual/i, '').trim(); var ni = $('#impname'); if (ni && !ni.value) ni.value = imp.meta.name; }
    var fn = imp.mode === 'lib' ? manualPrompt : refPrompt, ext = (f.name.split('.').pop() || '').toLowerCase();
    withBusy('impmanual', null, async function () {
      try {
        var acc = {};
        if (ext === 'docx') {
          setProg('manual', 'Reading ' + f.name + '…');
          var parts = chunkText(docxText(await readBuf(f)), 40000); acc.results = []; acc.skipped = [];
          if (!parts.length || parts.join('').length < 50) throw new Error('No readable text found in that Word file.');
          for (var i = 0; i < parts.length; i++) { setProg('manual', 'AI is reading part ' + (i + 1) + ' of ' + parts.length + '…'); acc.results.push(parseJson(await ai(textPrompt(fn) + '\n\nDOCUMENT TEXT:\n' + parts[i], 16000))); }
        } else {
          var pdf = await openPdf(await readBuf(f));
          await readPdf('manual', f.name, pdf, fn, acc);
        }
        imp.list = mergeManual(acc.results || []); imp.skipped = acc.skipped || [];
        setProg('manual', imp.list.length ? 'Done: ' + imp.list.length + ' sections found. Review below.' : 'No specification sections were found in that file.');
        impRender();
      } catch (err) { setProg('manual', ''); aiNote = null; setErr('manual', String(err && err.message || err)); throw err; }
    })();
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.dataset.act;
    if (act === 'libimport') { imp = { list: [], skipped: [], mode: 'lib', meta: {} }; impModal(); }
    else if (act === 'refimport') { imp = { list: [], skipped: [], mode: 'ref', meta: {} }; impModal(); }
    else if (act === 'impapply') {
      var picked = [].map.call(document.querySelectorAll('[data-impi]:checked'), function (c) { return imp.list[+c.dataset.impi]; });
      if (imp.mode === 'ref') {
        var nm = (($('#impname') || {}).value || '').trim(); if (!nm) return toast('Give the project a name.');
        var rec = { id: SS.uid(), name: nm, number: (($('#impnum') || {}).value || '').trim(), source: 'Imported manual', at: Date.now(), sections: picked.map(function (x) { return { code: x.code, title: x.title, body: x.body }; }) };
        archive.push(rec); saveArchive(); closeModal(); ui.view = 'archive'; ui.archId = rec.id; render(); toast(picked.length + ' sections saved to Reference projects'); return;
      }
      var std = $('#impstd') && $('#impstd').checked, n = 0;
      picked.forEach(function (x) {
        var old = library[x.code];
        libSet(x.code, { code: x.code, title: x.title || (old && old.title) || catTitle(x.code), body: x.body, questions: [], status: std ? 'standard' : 'reviewed', rev: ((old && old.rev) || 0) + 1 });
        n++;
      });
      saveLibrary(); closeModal(); render(); toast(n + ' sections added to the library');
    }
  });
