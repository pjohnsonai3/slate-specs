from playwright.sync_api import sync_playwright
APP='file:///home/claude/repo/slate-specs/slate-specs.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','RF'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.evaluate("""()=>{var s=__SS_DEBUG.projects[0].sections.find(s=>s.code=='01 100');s.body='# GENERAL\\n## SUMMARY\\n1: Coordinate with Section 12 345 "Furniture" and Section 01 400.\\n1: See also Section 12 345 for seating.'}""")
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(300); pg.click('#seclist .sec[data-code="01 100"]'); pg.wait_for_timeout(500)
    print('pill',pg.evaluate("document.querySelector('#seclist .sec[data-code=\"01 100\"] .badge:last-child').textContent"))
    print('marks',pg.evaluate("[...document.querySelectorAll('#preview .refbad')].map(m=>m.textContent)"))
    print('panel',pg.evaluate("(document.querySelector('#mid h2[style*=red]')||{}).textContent"))
    pg.screenshot(path='/tmp/ref.png')
    pg.click('[data-act=refadd]'); pg.wait_for_timeout(500)
    print('after add marks',pg.evaluate("document.querySelectorAll('#preview .refbad').length"),'pill',pg.evaluate("document.querySelector('#seclist .sec[data-code=\"01 100\"] .badge:last-child').textContent"))
    print('ERRORS',errs); b.close()
