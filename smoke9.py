import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json,subprocess
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1400,'height':900}); ctx.add_init_script("window.print=function(){window.__printed=true}")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Link Test'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:1'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(400); pg.click('[data-act=tab][data-t=sections]')
    pg.evaluate("""(()=>{const p=__SS_DEBUG.projects[0];const s=p.sections.find(s=>s.code=='09 910');s.body+='\\n# EXTRA\\n## COORD\\n1: Coordinate with Section 09 260 "Gypsum Wallboard Assemblies" and Section 01 100.';})()""")
    pg.click('[data-act=tab][data-t=export]')
    with pg.expect_download() as d: pg.click('[data-act=docx][data-scope=all]')
    d.value.save_as('s9.docx')
    pg.click('[data-act=pdf][data-scope=all]'); pg.wait_for_timeout(4000)
    fr=[f for f in pg.frames if f!=pg.main_frame][-1]
    html=fr.content(); open('s9.html','w').write(html)
    print('printed:',fr.evaluate('window.__printed'), 'anchors:',fr.evaluate("document.querySelectorAll('a[href^=\"#s-\"]').length"), 'bm:',fr.evaluate("document.querySelectorAll('.bm').length"), 'xr:',fr.evaluate("document.querySelectorAll('a.xr').length"))
    p2=ctx.new_page(); p2.set_content(html); p2.wait_for_timeout(500)
    p2.pdf(path='s9.pdf',prefer_css_page_size=True,print_background=True,outline=True,tagged=True)
    print('ERRORS',errs)
