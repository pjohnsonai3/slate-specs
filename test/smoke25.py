import os,json,shutil,tempfile,threading
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[];calls=[];lock=threading.Lock();CODES=[('09 260','GYPSUM BOARD'),('09 910','PAINTING'),('08 710','DOOR HARDWARE')]
def handler(route):
    body=json.loads(route.request.post_data); txt=json.dumps(body)
    if 'COVER PAGE' in txt:
        calls.append('cover'); out={"name":"Multi File Hotel","number":"27-002","owner":"MF Owner","address":"","cityState":"Atlanta, GA","phase":"CD","issueDate":"","architect":"","cm":"","mep":"","structural":"","interior":"","code":"","contractForm":""}
    else:
        with lock: n=len([c for c in calls if c=='sec']); calls.append('sec')
        c,t=CODES[n%3]; out={"sections":[{"code":c,"title":t,"body":"# GENERAL\n## SUMMARY\n1: %s text."%t,"partial":False}]}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}],"stop_reason":"end_turn"}))
src=os.environ.get('DOCX','s11.docx'); d=tempfile.mkdtemp()
names=['01 001 Table of Contents.docx','09 260 Gypsum Board.docx','09 910 Painting.docx','08 710 Door Hardware.docx']
for n in names: shutil.copy(src,os.path.join(d,n))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=pmopen]'); pg.set_input_files('#pmfile',[os.path.join(d,n) for n in names])
    pg.wait_for_selector('[data-pmi]',timeout=90000); pg.wait_for_timeout(500)
    print('calls',sorted(calls)); print('name:',pg.input_value('#pm-name'),'| sections listed',pg.locator('[data-pmi]').count(),'| dup badges',pg.locator('.badge:has-text("duplicate")').count(),'| toc note',pg.locator('text=was used for the project details').count())
    print('rows:',pg.evaluate("[...document.querySelectorAll('#pmreview .sec')].map(r=>r.querySelector('.c').innerText+' '+r.querySelector('.small:last-child')?.innerText)"))
    pg.click('#pmcreate'); pg.wait_for_timeout(400)
    print('project:',pg.evaluate("__SS_DEBUG.projects[0].sections.map(s=>s.code)"))
    b.close()
print('ERRORS',errs)
