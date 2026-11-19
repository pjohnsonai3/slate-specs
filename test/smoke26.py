import os,json,shutil,tempfile,threading
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[];calls=[];force=[];lock=threading.Lock();CODES=[('10 440','SIGNAGE'),('12 360','COUNTERTOPS'),('09 260','GYPSUM BOARD')]
def handler(route):
    with lock: n=len(calls); calls.append(1)
    c,t=(('09 260','GYPSUM BOARD') if force else CODES[n%3]); out={"sections":[{"code":c,"title":t,"body":"# GENERAL\n## SUMMARY\n1: IMPORTED %s text."%t,"partial":False}]}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}],"stop_reason":"end_turn"}))
src=os.environ.get('DOCX','s11.docx'); d=tempfile.mkdtemp()
names=['10 440 Signage.docx','12 360 Countertops.docx','09 260 Gypsum.docx','Table of Contents.docx']
for n in names: shutil.copy(src,os.path.join(d,n))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Add Sections Test'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:1'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.evaluate("(function(){var s=__SS_DEBUG.projects[0].sections; if(!s.some(x=>x.code==='09 260')) s.push({code:'09 260',title:'GYPSUM',on:true,body:'# GENERAL\\n## SUMMARY\\n1: ORIGINAL text.',questions:[],answers:{},status:'draft',libRev:0,aiKeys:[]})})()")
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(200); n0=pg.evaluate("__SS_DEBUG.projects[0].sections.length")
    pg.click('[data-act=pmaddopen]'); pg.set_input_files('#pmfile',[os.path.join(d,n) for n in names]); pg.wait_for_selector('[data-pmi]',timeout=90000); pg.wait_for_timeout(300)
    print('api calls (TOC skipped):',len(calls),'| rows',pg.locator('[data-pmi]').count(),'| unticked',pg.evaluate("[...document.querySelectorAll('[data-pmi]')].filter(c=>!c.checked).length"),'| replace badge',pg.locator('text=replaces its text').count())
    pg.click('[data-act=pmaddgo]'); pg.wait_for_timeout(400)
    print('sections added:',pg.evaluate("__SS_DEBUG.projects[0].sections.length")-n0,'| new present:',pg.evaluate("['10 440','12 360'].map(c=>__SS_DEBUG.projects[0].sections.some(s=>s.code===c))"),'| 09 260 untouched:',pg.evaluate("__SS_DEBUG.projects[0].sections.filter(s=>s.code==='09 260')[0].body.indexOf('IMPORTED')<0"))
    # second pass: replace existing
    calls.clear(); force.append(1); pg.click('[data-act=pmaddopen]'); pg.set_input_files('#pmfile',[os.path.join(d,'09 260 Gypsum.docx')]); pg.wait_for_selector('[data-pmi]',timeout=60000)
    pg.check('[data-pmi="0"]'); pg.click('[data-act=pmaddgo]'); pg.wait_for_timeout(400)
    print('replaced body:',pg.evaluate("__SS_DEBUG.projects[0].sections.filter(s=>s.code==='09 260')[0].body.indexOf('IMPORTED')>=0"),'| history kept:',pg.evaluate("(__SS_DEBUG.projects[0].sections.filter(s=>s.code==='09 260')[0].hist||[]).some(h=>h.body.indexOf('ORIGINAL')>=0||h.body.length>0)"))
    b.close()
print('ERRORS',errs)
