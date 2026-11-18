import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json, base64
from playwright.sync_api import sync_playwright
errs=[]; calls=[]
DRAW={"sheets":[{"no":"A-001","title":"COVER SHEET"},{"no":"A-601","title":"WALL TYPES"},{"no":"A-701","title":"FINISH SCHEDULE"}],
 "projectInfo":{"name":"River North Wellness Hotel","number":"2611","owner":"River North LLC","cityState":"Fort Lauderdale, FL","code":"Florida Building Code, 8th Edition"},
 "codeInfo":{"occupancy":"R-1","constructionType":"IA","sprinklered":"Yes"},
 "wallTypes":[{"mark":"W1","description":"5/8 Type X each side, 3-5/8 stud","rating":"1 HR"}],
 "doorInfo":{"doorTypes":["Flush wood"],"frameTypes":["HM"],"ratedDoors":"20 min","hardwareNotes":[]},
 "finishLegend":[{"tag":"P-1","category":"Paint","description":"Wall paint","manufacturer":"Benjamin Moore","product":"Regal Select","color":"OC-17"}],
 "roomFinishes":[],"generalNotes":["All gypsum board in wet areas to be moisture resistant."]}
FIN={"finishes":[{"tag":"P-1","category":"Paint","description":"Wall paint","manufacturer":"Benjamin Moore","product":"Regal Select","color":"White Dove","finish":"Eggshell","size":"","location":"Guest rooms"}],"notes":[]}
def handler(route):
    body=json.loads(route.request.post_data); c=body['messages'][0]['content']
    types=[x['type'] for x in c] if isinstance(c,list) else ['text']
    txt=c if isinstance(c,str) else ' '.join(x.get('text','') for x in c if x['type']=='text')
    docb=[x for x in c if isinstance(c,list) and x['type']=='document']
    calls.append({'types':types,'b64len':len(docb[0]['source']['data']) if docb else 0,'kind':'draw' if 'construction drawing set' in txt else 'fin' if 'finish and product specifications' in txt else 'check' if 'coordinating a specification section' in txt else 'gap' if 'covers what the drawings' in txt else 'fill' if 'questionnaire' in txt else 'other'})
    if 'construction drawing set' in txt: out=DRAW
    elif 'finish and product specifications' in txt: out=FIN
    elif 'coordinating a specification section' in txt: out={"findings":[{"sev":"conflict","text":"Finish legend P-1 is Benjamin Moore Regal Select but section lists a different manufacturer.","source":"Finish legend P-1"}]}
    elif 'covers what the drawings' in txt: out={"findings":[{"sev":"gap","text":"Wall covering called out; no wall covering section.","source":"Finish legend","addCode":"09 720"}]}
    elif 'questionnaire' in txt: out={"answers":{"manufacturer":"Benjamin Moore","wallSheen":"Eggshell"}}
    else: out={}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}]}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':900},accept_downloads=True).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text and errs.append(m.text))
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Upload Test'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:0'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300); pg.click('[data-act=tab][data-t=sections]')
    pg.click('[data-act=tab][data-t=sources]')
    pg.set_input_files('[data-upload=drawings]','drawings80.pdf'); pg.wait_for_selector('#modal',timeout=60000)
    print('info modal rows:', pg.locator('[data-infok]').count()); pg.click('[data-act=applyinfo]'); pg.wait_for_timeout(300)
    print('draw calls:', [(c['kind'],c['b64len']//1000) for c in calls])
    print('sheets in index:', pg.locator('[data-sheetno]').count())
    pg.set_input_files('[data-upload=finish]',['smoke.docx']); pg.wait_for_timeout(2500)
    print('finish source cards:', pg.locator('details').count())
    pg.screenshot(path='shot_sources.png')
    # fill all
    pg.click('[data-act=fillall]'); pg.wait_for_timeout(2500)
    pg.click('[data-act=tab][data-t=sections]'); pg.click('#seclist .sec[data-code="09 910"] .t'); pg.wait_for_timeout(300)
    print('AI-filled answers:', pg.locator('.q.ai').count(), '| sheet ref in preview:', 'Sheet A-701' in pg.inner_text('#preview'))
    pg.click('[data-act=checksec]'); pg.wait_for_timeout(1200); print('section findings panel:', pg.locator('text=Coordination findings').count())
    pg.click('[data-act=tab][data-t=coord]'); pg.click('[data-act=checkproj]'); pg.wait_for_timeout(1200)
    print('coord cards:', pg.locator('.panel .badge:text-is("gap")').count(), pg.locator('.panel .badge:text-is("conflict")').count())
    pg.click('[data-act=coadd]'); pg.wait_for_timeout(300)
    print('added 09 720:', 'ok' if pg.evaluate("window.__SS_DEBUG.projects[0].sections.some(s=>s.code==='09 720')") else 'NO')
    pg.screenshot(path='shot_coord.png')
    pg.reload(); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    print('persist sources/sheets/checks:', pg.evaluate("(()=>{const p=window.__SS_DEBUG.projects[0];return [p.sources.length,p.sheets.length,p.checks.length]})()"))
    b.close()
print('call summary:', {k:sum(1 for c in calls if c['kind']==k) for k in set(c['kind'] for c in calls)})
print('ERRORS:',errs)
