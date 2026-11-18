import os,json,shutil,tempfile
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[]
def handler(route):
    out={"sections":[{"code":"09 260","title":"GYPSUM BOARD (REVISED)","body":"# GENERAL\n## SUMMARY\n1: Revised by Addendum 2.","partial":False},{"code":"10 800","title":"TOILET ACCESSORIES","body":"# GENERAL\n## SUMMARY\n1: New section.","partial":False}]}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}],"stop_reason":"end_turn"}))
d=tempfile.mkdtemp(); f=os.path.join(d,'Addendum 2.docx'); shutil.copy(os.environ.get('DOCX','s11.docx'),f)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Mod Test'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:0'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300); pg.click('[data-act=tab][data-t=sections]')
    n0=pg.evaluate("__SS_DEBUG.projects[0].sections.length"); old=pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='09 260').body.length")
    pg.click('[data-act=tab][data-t=export]'); pg.wait_for_timeout(200)
    print('panel:', 'Modifications' in pg.inner_text('.wrap'))
    pg.click('[data-act=modopen]'); pg.set_input_files('#modfile',f); pg.wait_for_selector('[data-modi]',timeout=30000)
    print('rows:',pg.locator('[data-modi]').count(),'name:',pg.input_value('#modname'),'badges:',pg.inner_text('#modlist').count('replaces existing'),pg.inner_text('#modlist').count('new section'))
    pg.click('[data-act=modcmp]'); pg.wait_for_timeout(300); print('inline compare:', pg.locator('#modlist .rl-ins, #modlist ins, #modlist [class*=rl]').count()>0, 'list kept:',pg.locator('[data-modi]').count())
    pg.click('#modapply'); pg.wait_for_timeout(400)
    r=pg.evaluate("(()=>{var p=__SS_DEBUG.projects[0];return [p.sections.length,p.sections.find(s=>s.code=='09 260').body,p.sections.find(s=>s.code=='10 800')&&p.sections.find(s=>s.code=='10 800').title,p.mods.length]})()")
    print('after apply:',r[0]-n0,'added;',r[1][:60].replace('\n','|'),'|',r[2],'| mods',r[3])
    pg.click('[data-act=modundo]'); pg.wait_for_timeout(300)
    r=pg.evaluate("(()=>{var p=__SS_DEBUG.projects[0];return [p.sections.length,p.sections.find(s=>s.code=='09 260').body.length,(p.mods||[]).length,!!p.sections.find(s=>s.code=='10 800')]})()")
    print('after undo: sections',r[0]==n0,'body restored',r[1]==old,'mods',r[2],'new gone',not r[3])
    print('errors:',errs)
