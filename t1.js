const fs=require('fs'),vm=require('vm');
global.window=global;
const ff=fs.readFileSync('fflate_block.js','utf8'); (0,eval)(ff);
for(const f of ['engine','seed','docx']) (0,eval)(fs.readFileSync('../src/'+f+'.js','utf8'));
const SS=global.SS;
const project={name:'River North Wellness Hotel',number:'2611',owner:'River North Hospitality LLC',address:'201 SW 2nd St',cityState:'Fort Lauderdale, FL',phase:'Construction Documents',issueDate:'December 12, 2026',architect:'ai3, Inc.',code:'Florida Building Code, Building, 8th Edition (2023)',contractForm:'AIA A201-2017'};
let ok=0,bad=0; const t=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
// conditions
const ctx={answers:{a:'Yes',b:['X','Y'],c:'No'},qmap:{},vars:{}};
t('truthy',SS.evalCond('a',ctx)); t('falsy No',!SS.evalCond('c',ctx)); t('neg',SS.evalCond('!c',ctx));
t('eq',SS.evalCond('a=Yes',ctx)); t('multi',SS.evalCond('b=Y',ctx)); t('alt',SS.evalCond('a=No|Yes',ctx)); t('neq',SS.evalCond('a!=No',ctx)); t('and',SS.evalCond('a=Yes & !c',ctx)); t('and fail',!SS.evalCond('a=Yes & c',ctx));
// parse seed all
const secs=Object.values(SS.SEED);
t('seed count',secs.length===10);
secs.forEach(s=>{ const r=SS.render(s,project,{notes:true}); t(s.code+' parts',r.parts.length===3);
  const keys=new Set(s.questions.map(q=>q.key));
  (s.body.match(/\{\{(\w+)\}\}/g)||[]).forEach(m=>{const k=m.slice(2,-2); if(!keys.has(k)&&!(k in SS.projectVars({}))) t(s.code+' undeclared var '+k,false)});
  (s.body.match(/\?\(([^)]*)\)/g)||[]).forEach(m=>{m.slice(2,-1).split('&').forEach(term=>{const k=term.trim().replace(/^!/,'').split(/!?=/)[0].trim(); if(!keys.has(k)) t(s.code+' undeclared cond key '+k,false)})});
  console.log(s.code,s.title,'unresolved:',r.unresolved,'flags:',r.flags);});
// conditional behaviour
const g=JSON.parse(JSON.stringify(SS.SEED['09 260']));
let r1=SS.render({...g,answers:{typeX:'No',acoustic:'No',manufacturer:'USG'}},project); let tx1=SS.toText(r1);
t('typeX off', !/Fire-Rated Assemblies:/.test(tx1)); t('acoustic off',!/Acoustical Sealant/.test(tx1)); t('no shaft', !/SHAFT WALL/.test(tx1));
let r2=SS.render({...g,answers:{typeX:'Yes',acoustic:'Yes',shaftliner:'Yes',manufacturer:'USG'}},project); let tx2=SS.toText(r2);
t('typeX on', /Fire-Rated Assemblies:/.test(tx2)); t('shaft on', /SHAFT WALL/.test(tx2)); t('proj var', /Fort Lauderdale/.test(SS.toText(SS.render({...SS.SEED['01 100'],answers:{}},project))));
// cascading child drop
const cs={code:'99 99 99',title:'T',questions:[],answers:{},body:'# GENERAL\n## A\n1: ?(x) Parent\n2: Child\n3: Grandchild\n1: Sibling'};
const rc=SS.render(cs,{}); t('cascade',SS.toText(rc).includes('A. Sibling')&&!/Child/.test(SS.toText(rc)));
console.log(SS.toText(SS.render({...g,answers:{typeX:'Yes',manufacturer:'USG',acoustic:'No',moisture:'Yes',moistureLocations:'toilet rooms'}},project)).split('\n').slice(0,40).join('\n'));
// docx
const rendered=['01 100','01 300','06 402','09 260','09 910'].map(c=>SS.render({...SS.SEED[c],answers:{typeX:'Yes'}},project,{}));
const z=SS.buildDocx(project,rendered,{},global.fflate);
fs.writeFileSync('out.docx',z); console.log('docx bytes',z.length);
console.log(ok,'passed',bad,'failed');

/* ---- v2.0 additions ---- */
(function(){
  var ok=0,bad=0; function t(n,c){ if(c){ok++}else{bad++;console.log('FAIL',n)} }
  var d=SS.diffLines('a\nb\nc','a\nB\nc\nd'); var st=SS.diffStats(d); t('diff add/del',st.add===2&&st.del===1);
  t('diff same',!SS.diffStats(SS.diffLines('x\ny','x\ny')).changed);
  t('redline html',/rl-d/.test(SS.redlineHtml(d,1))&&/<ins>/.test(SS.redlineHtml(d,1)));
  t('hash',SS.hash('abc')===SS.hash('abc')&&SS.hash('abc')!==SS.hash('abd'));
  var proj={sections:[{code:'09 910',title:'Paint',on:true,body:''},{code:'06 900',origin:'06 402',title:'Casework',on:true,body:''}]};
  var sec={code:'09 260',title:'GWB',body:'# GENERAL\n## SUMMARY\n1: See Section 06 402 "Interior Architectural Woodwork" and Section 09 910 and Section 07 840 "Firestopping".',questions:[],answers:{}};
  var r=SS.render(sec,proj,{}); var tx=SS.toText(r);
  t('ref renumbered',/Section 06 900 "Casework"/.test(tx)); t('ref plain',/Section 09 910 and/.test(tx)); t('ref missing',r.refMissing.join()==='07 840');
  var sub=SS.submittals([SS.render({code:'09 260',title:'GWB',body:'# GENERAL\n## SUBMITTALS\n1: Product Data: manufacturer data.\n2: Include fire ratings.\n1: Samples: 12 inch samples.\n1: Test Reports: ASTM E84.\n## QUALITY ASSURANCE\n1: Something.',questions:[],answers:{}},{},{})]);
  t('sub count',sub.length===3); t('sub types',sub[0].type==='Product Data'&&sub[1].type==='Samples'&&sub[2].action==='Informational'); t('sub no',sub[0].no==='09 260-01'&&sub[0].details.length===1);
  console.log('v2.0 tests: '+ok+' passed '+bad+' failed');
})();
