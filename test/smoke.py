import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json, sys
from playwright.sync_api import sync_playwright
errs=[]
GEN={"questions":[{"key":"unitType","label":"Masonry unit type","type":"select","options":["CMU","Brick"],"help":""},{"key":"mfr","label":"Brick manufacturer","type":"text"}],
"body":"# GENERAL\n## SUMMARY\n1: Section includes {{unitType}} masonry units.\n## QUALITY ASSURANCE\n1: ?(unitType=Brick) Brick supplied by {{mfr}}.\n# PRODUCTS (Not Used)\n# EXECUTION (Not Used)"}
def handler(route):
    body=json.loads(route.request.post_data)
    txt=body['messages'][0]['content']
    out = {"answers":{"workHours":"6:00 a.m. to 3:00 p.m.","ofoi":"Yes"}} if 'questionnaire' in txt else (GEN if 'SECTION TEXT FORMAT' in txt else None)
    if out is None: out="- No issues found."; 
    t = out if isinstance(out,str) else json.dumps(out)
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":t}]}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1500,'height':900},accept_downloads=True)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text and errs.append(m.text))
    pg.route('https://api.anthropic.com/**',handler)
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]')
    pg.fill('[data-pf=name]','Smoke Test Hotel'); pg.fill('[data-pf=number]','2699'); pg.fill('[data-pf=owner]','Test Owner LLC'); pg.fill('[data-pf=cityState]','Atlanta, GA')
    pg.select_option('#npstart',index=2); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    n=pg.locator('#seclist .sec').count(); print('sections in list',n)
    pg.click('#seclist .sec[data-code="09 260"] .t'); pg.wait_for_timeout(200)
    pg.select_option('[data-q=thickness]','1/2 inch'); pg.fill('[data-q=manufacturer]','TestBoard Co'); pg.fill('[data-q=moistureLocations]','toilet rooms')
    pg.select_option('[data-q=moisture]','Yes'); pg.wait_for_timeout(200)
    prev=pg.inner_text('#preview'); print('preview has answer:', 'TestBoard Co' in prev, 'toilet rooms' in prev, 'Moisture- and Mold' in prev)
    pg.screenshot(path='shot_sections.png')
    # generate for a section with no text
    pg.click('#seclist .sec[data-code="04 200"] .t'); pg.wait_for_timeout(200)
    pg.click('[data-act=gen]'); pg.wait_for_timeout(1200)
    print('gen preview:', 'masonry' in pg.inner_text('#preview') or 'unitType' in pg.inner_text('#preview') or 'Masonry unit type' in pg.inner_text('#preview'))
    pg.select_option('[data-q=unitType]','Brick'); pg.fill('[data-q=mfr]','Acme Brick'); pg.wait_for_timeout(200)
    print('conditional shown:', 'Acme Brick' in pg.inner_text('#preview'))
    # fill from notes on 01 100
    pg.click('[data-act=tab][data-t=info]'); pg.fill('[data-pnotes]','Work hours 6am to 3pm. Owner furnishes the FF&E.'); pg.click('[data-act=tab][data-t=sections]')
    pg.click('#seclist .sec[data-code="01 100"] .t'); pg.click('[data-act=fillnotes]'); pg.wait_for_timeout(800)
    print('ai-filled:', pg.locator('.q.ai').count(), pg.input_value('[data-q=workHours]'))
    # review
    pg.click('[data-act=review]'); pg.wait_for_timeout(600); print('review modal:', pg.locator('#modal').count()); pg.click('[data-act=closemodal]')
    # export
    pg.click('[data-act=tab][data-t=export]')
    with pg.expect_download() as d: pg.click('[data-act=docx][data-scope=all]')
    d.value.save_as('smoke.docx'); print('docx saved', d.value.suggested_filename)
    pg.screenshot(path='shot_export.png')
    # library
    pg.click('[data-act=nav][data-v=library]'); pg.click('.sec[data-code="09 910"]'); pg.wait_for_timeout(200); print('library editor:', pg.locator('[data-lib=body]').count())
    pg.screenshot(path='shot_library.png')
    # persistence
    pg.reload(); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    print('persisted projects:', pg.locator('.card').count())
    b.close()
print('ERRORS:',errs)
