import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json,re
from playwright.sync_api import sync_playwright
errs=[];calls=[]
def handler(route):
    body=json.loads(route.request.post_data); c=body['messages'][0]['content']
    txt=' '.join(x.get('text','') for x in c if x['type']=='text')
    m=re.search(r'pages (\d+)–(\d+) of (\d+)',txt); a=int(m.group(1)) if m else 0
    calls.append((a,len(c[0]['source']['data'])//1000))
    secs=[{"code":"09260","title":"GYPSUM WALLBOARD ASSEMBLIES","body":"# GENERAL\n## SUMMARY\n1: Submittals: Product Data. at [Project Location]","partial":True},
          {"code":"09 260","title":"Gypsum Wallboard Assemblies","body":"1: continued line "+str(a),"partial":False}]
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps({"sections":secs})}],"stop_reason":"end_turn"}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':900}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=nav][data-v=library]') if pg.locator('[data-act=nav][data-v=library]').count() else pg.click('text=Library')
    pg.click('[data-act=libimport]'); pg.set_input_files('#impfile',os.environ.get('SAMPLE_MANUAL','sample-manual.pdf'))
    pg.wait_for_selector('[data-impi]',timeout=240000)
    print('calls',len(calls),calls[:3]); print('rows',pg.locator('[data-impi]').count(), pg.locator('#implist .sec').first.inner_text())
    pg.click('#impapply'); pg.wait_for_timeout(500)
    print(pg.evaluate("JSON.stringify([library_has=Object.keys(JSON.parse(localStorage.getItem('ss1_library')||'{}')).includes('09 260'), (JSON.parse(localStorage.getItem('ss1_library'))['09 260']||{}).status])"))
    print(pg.evaluate("JSON.parse(localStorage.getItem('ss1_library'))['09 260'].body.split('\\n').length"))
    print('ERRORS',errs)
