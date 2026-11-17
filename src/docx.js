/* ============================================================================
   Slate Specs — DOCX writer  (docx.js)
   Builds a real Word file with NATIVE multilevel numbering (PART 1 / 1.1 / A. /
   1. / a. / 1)) so spec writers can keep editing in Word and the outline stays
   live. Each spec section is its own Word section: its own footer
   ("09 260 - 3") and page numbering restarting at 1, per CSI practice.
   Needs fflate (zipSync, strToU8).  Unresolved [brackets] are highlighted.
   ========================================================================= */
(function (root) {
  'use strict';
  var SS = root.SS = root.SS || {};
  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
           'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  function x(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function run(t, o) {
    o = o || {};
    var rp = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.caps ? '<w:caps/>' : '') +
             (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.sz ? '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>' : '') +
             (o.hl ? '<w:highlight w:val="yellow"/>' : '');
    return '<w:r>' + (rp ? '<w:rPr>' + rp + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
  }
  var bmId = 0;
  function bmName(k, code) { return k + '_' + String(code).replace(/\s/g, ''); }
  function bm(name, inner) { bmId++; return '<w:bookmarkStart w:id="' + bmId + '" w:name="' + name + '"/>' + inner + '<w:bookmarkEnd w:id="' + bmId + '"/>'; }
  function link(code, inner) { return '<w:hyperlink w:anchor="' + bmName('s', code) + '" w:history="1">' + inner + '</w:hyperlink>'; }
  /* a field Word recalculates (page numbers in the table of contents) */
  function fld(instr, cached) { return '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>' + cached + '</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'; }
  function segRuns(segs, base) {
    return segs.map(function (s) { var o = {}; for (var k in base) o[k] = base[k]; if (s.fl) o.hl = true; var r = run(s.t, o); return s.ref ? '<w:hyperlink w:anchor="' + bmName('s', s.ref) + '" w:history="1">' + r + '</w:hyperlink>' : r; }).join('');
  }
  // pPr child order matters to Word: keepNext, pageBreakBefore, numPr, tabs, spacing, ind, jc, rPr, sectPr
  function para(o) {
    var pp = '';
    if (o.keepNext) pp += '<w:keepNext/>';
    if (o.pb) pp += '<w:pageBreakBefore/>';
    if (o.num) pp += '<w:numPr><w:ilvl w:val="' + o.num.lvl + '"/><w:numId w:val="' + o.num.id + '"/></w:numPr>';
    if (o.tabs) pp += '<w:tabs>' + o.tabs + '</w:tabs>';
    if (o.sp) pp += '<w:spacing w:before="' + (o.sp[0] || 0) + '" w:after="' + (o.sp[1] || 0) + '"/>';
    if (o.ind) pp += '<w:ind w:left="' + o.ind + '"/>';
    if (o.jc) pp += '<w:jc w:val="' + o.jc + '"/>';
    if (o.sect) pp += o.sect;
    return '<w:p>' + (pp ? '<w:pPr>' + pp + '</w:pPr>' : '') + (o.runs || '') + '</w:p>';
  }
  function sectPr(footerRid, restart, headerRid) {
    return '<w:sectPr>' + (headerRid ? '<w:headerReference w:type="default" r:id="' + headerRid + '"/>' : '') + (footerRid ? '<w:footerReference w:type="default" r:id="' + footerRid + '"/>' : '') +
      '<w:type w:val="nextPage"/><w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="1700" w:right="1300" w:bottom="1500" w:left="1300" w:header="720" w:footer="500" w:gutter="0"/>' +
      (restart ? '<w:pgNumType w:start="1"/>' : '') + '</w:sectPr>';
  }

  function numberingXml(sectionCount) {
    var lv = [
      ['decimal', 'PART %1 - ', 0, 0, 'space', true],
      ['decimal', '%1.%2', 1080, 1080, 'tab', true],
      ['upperLetter', '%3.', 1440, 720, 'tab', false],
      ['decimal', '%4.', 2160, 720, 'tab', false],
      ['lowerLetter', '%5.', 2880, 720, 'tab', false],
      ['decimal', '%6)', 3600, 720, 'tab', false]
    ];
    var a = '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>';
    lv.forEach(function (l, i) {
      a += '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="' + l[0] + '"/>' +
        '<w:lvlText w:val="' + l[1] + '"/><w:lvlJc w:val="left"/><w:suff w:val="' + l[4] + '"/>' +
        '<w:pPr><w:ind w:left="' + l[2] + '" w:hanging="' + l[3] + '"/></w:pPr>' +
        (l[5] ? '<w:rPr><w:b/></w:rPr>' : '') + '</w:lvl>';
    });
    a += '</w:abstractNum>';
    var nums = '';
    for (var i = 1; i <= sectionCount; i++) {
      nums += '<w:num w:numId="' + i + '"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ' + NS + '>' + a + nums + '</w:numbering>';
  }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + NS + '>' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>' +
    '</w:styles>';

  /* project: info fields.  items: [{ r: rendered section, notes?: bool }] */
  SS.buildDocx = function (project, rendered, opts, fflate) {
    opts = opts || {};
    var body = [], footers = [], files = {};
    var sectionCount = rendered.length;
    var totalSections = 0;
    var projName = (project.name || 'Project').toUpperCase();

    var headers = [];
    var st = project.phase || '', dt = project.issueDate || '', loc = project.cityState || '';
    function sz(t, o) { o = o || {}; return '<w:r><w:rPr>' + (o.b ? '<w:b/>' : '') + '<w:sz w:val="' + (o.sz || 16) + '"/></w:rPr>' + (o.tab ? '<w:tab/>' : '<w:t xml:space="preserve">' + x(t) + '</w:t>') + '</w:r>'; }
    var TABS = '<w:tab w:val="center" w:pos="4820"/><w:tab w:val="right" w:pos="9640"/>';
    function addHeader(title, code) {
      var n = headers.length + 1;
      headers.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '>' +
        para({ tabs: TABS, sp: [0, 0], runs: sz('', { tab: 1 }) + sz(title, { b: 1 }) + sz('', { tab: 1 }) + sz(st) }) +
        para({ tabs: TABS, sp: [0, 0], runs: sz('', { tab: 1 }) + sz(code, { b: 1 }) + sz('', { tab: 1 }) + sz(dt) }) + '</w:hdr>');
      return 'rIdH' + n;
    }
    function addFooter(codePrefix) {
      var n = footers.length + 1;
      footers.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '>' +
        para({ jc: 'right', sp: [0, 0], runs: sz(projName) }) +
        (loc ? para({ jc: 'right', sp: [0, 0], runs: sz(loc) }) : '') +
        para({ jc: 'right', sp: [60, 0], runs: sz(codePrefix) + '<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>' }) +
        '</w:ftr>');
      return 'rIdF' + n;
    }

    if (opts.cover !== false) {
      var C = function (t, o) { return para({ jc: 'center', sp: [0, 40], runs: run(t, o) }); };
      body.push(para({ sp: [1500, 60], jc: 'center', runs: run(project.name || 'Project Name', { b: true, sz: 30 }) }));
      if (project.address) body.push(C('at ' + project.address, { sz: 22 }));
      if (loc) body.push(C(loc, { sz: 22 }));
      body.push(para({ sp: [700, 40], jc: 'center', runs: st ? run(st, { b: true, sz: 20 }) : '' }));
      body.push(C('PROJECT MANUAL', { b: true, sz: 20 }));
      if (project.number) body.push(C('ai3 Project No. ' + project.number, { sz: 20 }));
      if (dt) body.push(C(dt, { sz: 20 }));
      var parties = [['Owner', project.owner], ['Architect of Record', project.architect || 'ai3, Inc.'], ['Construction Management', project.cm || project.contractor], ['MEP Engineer', project.mep], ['Structural Engineer', project.structural], ['Interior Designer', project.interior]].filter(function (p) { return p[1]; });
      body.push(para({ sp: [2400, 0], runs: '' }));
      var cell = function (p) { return '<w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>' + (p ? para({ sp: [160, 0], runs: run(p[0], { b: true, sz: 19 }) }) + para({ sp: [0, 0], runs: run(p[1], { sz: 19 }) }) : para({ runs: '' })) + '</w:tc>'; };
      var trs = '';
      for (var i = 0; i < parties.length; i += 2) trs += '<w:tr>' + cell(parties[i]) + cell(parties[i + 1]) + '</w:tr>';
      body.push('<w:tbl><w:tblPr><w:tblW w:w="9600" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4800"/><w:gridCol w:w="4800"/></w:tblGrid>' + trs + '</w:tbl>');
      body.push(para({ sp: [0, 0], sect: sectPr(null, false) }));

      var tocHead = addHeader('TABLE OF CONTENTS', 'SECTION 01 001');
      var W = [900, 3300, 1500, 1800, 2100];
      var tc = function (t, w, o, span) { return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (span ? '<w:gridSpan w:val="' + span + '"/>' : '') + (o && o.bb ? '<w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/></w:tcBorders>' : '') + '</w:tcPr>' + para({ sp: [o && o.top ? 200 : 20, 20], keepNext: !!(o && o.top), runs: o && o.raw ? o.raw : t ? run(t, { b: !!(o && o.b), sz: 17 }) : '' }) + '</w:tc>'; };
      var tr = function (cells) { return '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + cells + '</w:tr>'; };
      var rowsx = tr(tc('Division', W[0]) + tc('Section Title', W[1]) + tc('Pages', W[2]) + tc('Issue Date', W[3]) + tc('Latest Release', W[4]));
      SS.tocModel(project, rendered).forEach(function (g) {
        rowsx += tr(tc(g.head, 9600, { b: 1, bb: 1, top: 1 }, 5));
        g.rows.forEach(function (r) {
          var isSec = r.code && r.code !== '01 001';
          var pages = !r.code ? '' : isSec ? run(r.code + '-', { sz: 17 }) + fld('PAGEREF ' + bmName('e', r.code) + ' \\h', '1') : run('01 001-', { sz: 17 }) + fld('PAGEREF ' + bmName('e', '01 001') + ' \\h', '1');
          rowsx += r.note ? tr(tc('', W[0]) + tc(r.note, W[1] + W[2] + W[3] + W[4], {}, 4)) : tr(tc('', W[0], { raw: link(r.code, run(r.code, { sz: 17 })) }) + tc('', W[1], { raw: link(r.code, run(r.title, { sz: 17 })) }) + tc('', W[2], { raw: pages }) + tc(r.issue || dt, W[3]) + tc(r.latest || dt, W[4]));
        });
        if (g.na) rowsx += tr(tc(g.na, 9600, {}, 5));
      });
      body.push('<w:tbl><w:tblPr><w:tblW w:w="9600" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>' + W.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>' + rowsx + '</w:tbl>');
      var tocFooter = addFooter('01 001-');
      body.push(para({ sp: [0, 0], runs: bm(bmName('e', '01 001'), ''), sect: sectPr(tocFooter, true, tocHead) }));
    }

    rendered.forEach(function (r, idx) {
      var numId = idx + 1;
      var fr = addFooter(r.code + '-'), hr = addHeader(r.title.toUpperCase(), 'SECTION ' + r.code);
      r.parts.forEach(function (pt) {
        body.push(para({ keepNext: true, jc: 'center', sp: [300, 160], num: { id: numId, lvl: 0 }, runs: (pt === r.parts[0] ? bm(bmName('s', r.code), run(pt.title, { b: true })) : run(pt.title, { b: true })) }));
        pt.articles.forEach(function (ar) {
          body.push(para({ keepNext: true, sp: [200, 80], num: { id: numId, lvl: 1 }, runs: run(ar.title, { b: true }) }));
          ar.paras.forEach(function (pa) {
            if (pa.note) { body.push(para({ ind: 720, runs: segRuns(pa.segs, { i: true, color: '666666' }) })); return; }
            body.push(para({ num: { id: numId, lvl: pa.l + 1 }, runs: segRuns(pa.segs, {}) }));
          });
        });
      });
      body.push(para({ jc: 'center', sp: [360, 0], runs: bm(bmName('e', r.code), run('END OF SECTION ' + r.code, { b: true })), sect: sectPr(fr, true, hr) }));
    });

    // The last Word section's properties must be the final child of <w:body>.
    var lastParaEnd = body.length ? body.pop() : '';
    var m = /<w:sectPr>[\s\S]*<\/w:sectPr>/.exec(lastParaEnd);
    var finalSect = m ? m[0] : sectPr(null, true);
    lastParaEnd = lastParaEnd.replace(/<w:sectPr>[\s\S]*<\/w:sectPr>/, '');
    body.push(lastParaEnd);

    var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body.join('') + finalSect + '</w:body></w:document>';

    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>';
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>';
    headers.forEach(function (h, i) {
      var n = i + 1;
      files['word/header' + n + '.xml'] = fflate.strToU8(h);
      rels += '<Relationship Id="rIdH' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header' + n + '.xml"/>';
      ct += '<Override PartName="/word/header' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>';
    });
    footers.forEach(function (f, i) {
      var n = i + 1;
      files['word/footer' + n + '.xml'] = fflate.strToU8(f);
      rels += '<Relationship Id="rIdF' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer' + n + '.xml"/>';
      ct += '<Override PartName="/word/footer' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>';
    });
    rels += '</Relationships>'; ct += '</Types>';

    files['[Content_Types].xml'] = fflate.strToU8(ct);
    files['_rels/.rels'] = fflate.strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    files['word/document.xml'] = fflate.strToU8(doc);
    files['word/_rels/document.xml.rels'] = fflate.strToU8(rels);
    files['word/styles.xml'] = fflate.strToU8(STYLES);
    files['word/numbering.xml'] = fflate.strToU8(numberingXml(sectionCount));
    files['word/settings.xml'] = fflate.strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>');
    return fflate.zipSync(files);
  };
})(typeof window !== 'undefined' ? window : globalThis);
