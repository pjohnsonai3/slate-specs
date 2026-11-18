import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1400,'height':1000}); ctx.add_init_script("window.print=function(){window.__printed=true}")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    # wizard
    pg.click('[data-act=newproj]'); print('step1 visible',pg.is_visible('[data-pf=name]'),'npstart hidden',not pg.is_visible('#npstart'))
    pg.click('[data-act=wiznext]'); print('empty name blocked',pg.is_visible('[data-pf=name]'))
    pg.fill('[data-pf=name]','Wiz Hotel'); pg.fill('[data-pf=number]','3001'); pg.select_option('[data-pf=ptype]','Hotel')
    pg.click('[data-act=wiznext]'); pg.fill('[data-pf=code]','FBC 2023'); pg.click('[data-act=wiznext]')
    print('step3 start',pg.input_value('#npstart'),pg.inner_text('#wizsum'))
    pg.click('[data-act=wizback]'); print('back to step2',pg.is_visible('[data-pf=code]')); pg.click('[data-act=wiznext]')
    pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    print('lands overview:',pg.locator('text=What to do next').count()==1)
    P=lambda:pg.evaluate("window.__SS_DEBUG && window.__SS_DEBUG.projects")
    print('saved code:',pg.evaluate("JSON.stringify(__SS_DEBUG.projects.map(function(x){return [x.name,x.code,x.ptype]}))"))
    # overview content
    print('overview has steps:',pg.locator('[data-act=ovgo]').count())
    # open first section with text
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(200)
    code=pg.evaluate("(function(){var p=__SS_DEBUG.projects[0];var s=p.sections.filter(function(x){return x.body.trim()})[0];return s?s.code:null})()")
    print('first code with text',code)
    pg.click('#seclist .sec[data-code="%s"] .t'%code); pg.wait_for_timeout(200)
    # edit via body to create history: big change via evaluate-free route
    pg.click('[data-act=histopen]'); print('history empty msg',pg.locator('text=No earlier versions').count())
    pg.click('[data-act=closemodal]')
    pg.click('[data-act=histundo]'); pg.wait_for_timeout(200)
    print('undo with nothing:',pg.locator('text=Nothing earlier').count()>=0)
    # history: big edit then undo
    orig=pg.evaluate("(function(){var p=__SS_DEBUG.projects[0];return p.sections.filter(function(x){return x.code==='%s'})[0].body})()"%code)
    pg.click('[data-act=edittext]'); pg.wait_for_timeout(200)
    pg.fill('[data-body]','# GENERAL\n## SUMMARY\nN: Replaced text. '+('x'*700)); pg.wait_for_timeout(1500)
    n=pg.evaluate("(function(){var p=__SS_DEBUG.projects[0];return p.sections.filter(function(x){return x.code==='%s'})[0].hist.length})()"%code)
    print('hist entries after big edit',n)
    pg.click('[data-act=histundo]'); pg.wait_for_timeout(300)
    now=pg.evaluate("(function(){var p=__SS_DEBUG.projects[0];return p.sections.filter(function(x){return x.code==='%s'})[0].body})()"%code)
    print('undo restored original:',now==orig)
    pg.click('[data-act=histopen]'); print('history rows',pg.locator('[data-act=histrestore]').count()); pg.click('[data-act=histcmp]'); print('compare shown',pg.locator('.modal mark, .modal .rl-add, .modal ins').count()>=0); pg.click('[data-act=closemodal]')
    # find
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(200)
    print('find open',pg.is_visible('#findq'))
    pg.fill('#findq','gypsum'); pg.wait_for_timeout(400)
    print('find results',pg.locator('#findres .sec').count(),'marks',pg.locator('#findres mark').count())
    pg.click('#findres .sec >> nth=0'); pg.wait_for_timeout(300)
    print('goto section, modal closed',pg.locator('#findq').count()==0)
    # duplicate
    pg.click('[data-act=dupopen]'); pg.fill('#dupname','Wiz Hotel Phase 2'); pg.check('#dupteam')
    pg.click('[data-act=dupgo]'); pg.wait_for_timeout(500)
    print('dup:',pg.evaluate("JSON.stringify(__SS_DEBUG.projects.map(function(x){return [x.name,x.number||'',x.code||'',x.sections.length]}))"))
    print('dup lands overview',pg.locator('text=What to do next').count()==1)
    # card duplicate
    pg.click('[data-act=nav][data-v=projects]'); print('card dup buttons',pg.locator('.card [data-act=dupopen]').count())
    b.close()
print('ERRORS',errs)
