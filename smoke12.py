import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json,re
from playwright.sync_api import sync_playwright
errs=[];calls=[]
def handler(route):
    body=json.loads(route.request.post_data); c=body['messages'][0]['content']
    txt=c if isinstance(c,str) else ' '.join(x.get('text','') for x in c if x['type']=='text')
    if 'Convert this specification section' in txt:
        out={"body":"# GENERAL\n## SUMMARY\n1: Cleaned text at [Project Location]"}; calls.append('clean')
    else:
        m=re.search(r'pages (\d+)–(\d+) of (\d+)',txt); a=int(m.group(1)) if m else 0
        calls.append('read' if 'REFERENCE copy' in txt else 'lib?')
        out={"sections":[{"code":"09260","title":"GYPSUM WALLBOARD ASSEMBLIES","body":"# GENERAL\n## SUMMARY\n1: The Perlant gypsum board at 3050 Peachtree Road.","partial":a>1},
                         {"code":"09 910","title":"PAINT","body":"# GENERAL\n## SUMMARY\n1: Benjamin Moore paint.","partial":False}]}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}],"stop_reason":"end_turn"}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':900}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Target Proj'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:1'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300); pg.click('[data-act=tab][data-t=sections]')
    pg.click('[data-act=nav][data-v=archive]'); pg.wait_for_timeout(200)
    print('empty state:', 'No reference projects yet' in pg.inner_text('.wrap'))
    # Word import (reference mode)
    pg.click('[data-act=refimport]'); pg.set_input_files('#impfile','s11.docx'); pg.wait_for_selector('[data-impi]',timeout=60000)
    print('docx rows',pg.locator('[data-impi]').count(),'name prefilled:',pg.input_value('#impname'))
    pg.fill('#impname','Docx Project'); pg.click('#impapply'); pg.wait_for_timeout(400)
    # PDF import
    pg.click('[data-act=archback]'); pg.click('[data-act=refimport]'); pg.fill('#impname','The Perlant'); pg.set_input_files('#impfile',os.environ.get('SAMPLE_MANUAL','sample-manual.pdf')); pg.wait_for_selector('[data-impi]',timeout=300000)
    pg.click('#impapply'); pg.wait_for_timeout(500)
    print('archive:',pg.evaluate("JSON.parse(localStorage.getItem('ss1_archive')).map(a=>a.name+':'+a.sections.length)"),'calls',set(calls))
    pg.click('[data-act=archback]'); pg.fill('#archq','peachtree'); pg.wait_for_timeout(300)
    print('search hits:',pg.locator('[data-act=avopen]').count())
    pg.click('[data-act=avopen] >> nth=0'); pg.wait_for_timeout(300)
    pg.check('#avclean'); pg.click('[data-act=avuse]'); pg.wait_for_timeout(800)
    print('copied+cleaned:',pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='09 260').body.includes('Cleaned text')"),'clean calls',calls.count('clean'))
    # master
    pg.fill('#archq','paint'); pg.wait_for_timeout(300); pg.click('[data-act=avopen] >> nth=0'); pg.click('[data-act=avlib]'); pg.wait_for_timeout(500)
    print('master has paint body:', pg.evaluate("JSON.parse(localStorage.getItem('ss1_library'))['09 910'].body.includes('Benjamin Moore')"))
    # section editor Reference
    pg.click('[data-act=nav][data-v=projects]'); pg.click('[data-act=open] >> nth=0'); pg.wait_for_timeout(300); pg.click('[data-act=tab][data-t=sections]')
    pg.evaluate("document.querySelector('#seclist .sec[data-code=\"09 910\"] .t').click()"); pg.wait_for_timeout(300)
    pg.click('[data-act=refsec]'); pg.wait_for_timeout(300); print('ref hits:',pg.locator('#refres [data-act=refhere]').count()); pg.screenshot(path='s12_ref.png')
    pg.click('#refres [data-act=refhere] >> nth=0'); pg.wait_for_timeout(500)
    print('replaced:',pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='09 910').body.includes('Benjamin Moore')"))
    # archive this project
    pg.click('[data-act=tab][data-t=export]'); pg.click('[data-act=archadd]'); pg.wait_for_timeout(400)
    print('archive count:',pg.evaluate("JSON.parse(localStorage.getItem('ss1_archive')).length"))
    pg.click('[data-act=nav][data-v=archive]'); pg.screenshot(path='s12_list.png')
    print('ERRORS',errs)
