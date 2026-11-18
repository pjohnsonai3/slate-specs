import os,json,re,shutil,tempfile
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[];calls=[]
def handler(route):
    body=json.loads(route.request.post_data); calls.append(1)
    out={"sections":[{"code":"09 260","title":"GYPSUM BOARD","body":"# GENERAL\n## SUMMARY\n1: Text.","partial":False},{"code":"09 910","title":"PAINT","body":"# GENERAL\n## SUMMARY\n1: Paint.","partial":False}]}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}],"stop_reason":"end_turn"}))
src=os.environ.get('DOCX','s11.docx'); d=tempfile.mkdtemp()
names=['River North Hotel Manual.docx','Cafe Bistro Restaurant.docx','Tower Office TI.docx','Plain Project.docx']
for n in names: shutil.copy(src,os.path.join(d,n))
bad=os.path.join(d,'Broken.docx'); open(bad,'wb').write(b'not a zip')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.evaluate("localStorage.setItem('ss1_archive',JSON.stringify([{id:'x',name:'Plain Project',source:'Imported manual',at:1,sections:[{code:'09 910',title:'P',body:'x'}]}]))"); pg.reload(); pg.wait_for_timeout(900)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=nav][data-v=archive]'); pg.click('[data-act=bulkimport]'); pg.wait_for_timeout(200)
    pg.set_input_files('#bulkfile',[os.path.join(d,n) for n in names]+[bad]); pg.wait_for_timeout(300)
    print('rows:',pg.locator('#bulkrows tr').count(),'guessed:',pg.evaluate("[...document.querySelectorAll('[data-btype]')].map(s=>s.value)"))
    pg.select_option('[data-btype="3"]','Residential')
    pg.click('#bulkstart'); pg.wait_for_function("!document.querySelector('#bulkstop') || document.querySelector('#bulkstop').style.display==='none'",timeout=90000); pg.wait_for_timeout(500)
    print('status:',pg.evaluate("[...document.querySelectorAll('#bulkrows tr')].map(r=>r.cells[3].innerText.trim())"))
    print('archive:',pg.evaluate("JSON.parse(localStorage.getItem('ss1_archive')).map(a=>a.name+'|'+(a.ptype||'')+'|'+a.sections.length)"))
    print('api calls',len(calls)); print('errors:',errs)
