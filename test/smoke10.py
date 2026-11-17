import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json
from playwright.sync_api import sync_playwright
errs=[]
FIN={"finishes":[{"tag":"P-1","category":"Paint","description":"Wall paint","manufacturer":"Benjamin Moore","product":"Regal","color":"","finish":"Eggshell","size":"","location":""}],"hardwareSets":[],"hardwareNotes":[],"otherSpecs":[],"notes":[]}
def handler(route):
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(FIN)}],"stop_reason":"end_turn"}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':900}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Std Test'); pg.select_option('#npstart',index=1); pg.click('[data-act=createproj]'); pg.wait_for_timeout(400)
    pg.evaluate("""(()=>{const s=__SS_DEBUG.projects[0].sections.find(s=>s.code=='09 910');s.body='# GENERAL\\n## SUMMARY\\n1: Paint.\\n## QUALITY ASSURANCE\\n1: Comply with ASTM E84, ASTM D4060-14 and NFPA 101 and ASTM E648. Also UL 723.\\n# PRODUCTS\\n## MATERIALS\\n1: Paint.\\n# EXECUTION\\n## INSTALLATION\\n1: Apply.'})()""")
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#seclist .sec[data-code=\"09 910\"] .t').click()"); pg.wait_for_timeout(300)
    pg.click('[data-act=buildrefs]'); pg.wait_for_timeout(300)
    body=pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='09 910').body"); print(body)
    pg.click('[data-act=buildrefs]'); pg.wait_for_timeout(300)
    print('idempotent:', body==pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='09 910').body"))
    # settings panel
    pg.click('[data-act=nav][data-v=settings]'); pg.wait_for_timeout(300)
    print('std rows:', pg.locator('[data-stdf=title]').count()); pg.screenshot(path='s10_set.png')
    pg.fill('#stdorg','UL'); pg.fill('#stdno','723'); pg.fill('#stdtitle','Standard for Test for Surface Burning Characteristics of Building Materials'); pg.click('[data-act=stdadd]'); pg.wait_for_timeout(300)
    # manufacturers
    pg.click('[data-act=nav][data-v=projects]'); pg.click('[data-act=open] >> nth=0'); pg.wait_for_timeout(300)
    pg.click('[data-act=tab][data-t=sources]'); pg.set_input_files('[data-upload=finish]',['smoke.docx']); pg.wait_for_timeout(2500)
    print('mfr panel:', 'Benjamin Moore' in pg.inner_text('.wrap'))
    pg.click('[data-act=tab][data-t=sections]'); pg.evaluate("document.querySelector('#seclist .sec[data-code=\"09 910\"] .t').click()"); pg.wait_for_timeout(300)
    pg.click('[data-act=buildrefs]'); pg.wait_for_timeout(200)
    pg.click('[data-act=mfrins]'); pg.wait_for_timeout(300); pg.check('[data-mfr="0"]'); pg.click('[data-act=mfrgo]'); pg.wait_for_timeout(300)
    print(pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='09 910').body.split('\\n').filter(l=>/MANUFACT|Benjamin|UL/.test(l))"))
    print('ERRORS',errs)
