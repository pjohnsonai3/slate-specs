from playwright.sync_api import sync_playwright
APP='file:///home/claude/repo/slate-specs/slate-specs.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','FR'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.evaluate("""()=>{var P=__SS_DEBUG.projects[0];P.sections.find(s=>s.code=='01 100').body='# GENERAL\\n## SUMMARY\\n1: The Contractor shall coordinate. Contractor again {{project.name}}.\\n1: Hidden contractor line ?(never=x)';P.sections.find(s=>s.code=='01 250').body='# GENERAL\\n## A\\n1: Subcontractor and Contractor.'}""")
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(300)
    pg.click('[data-act=fropen]'); pg.fill('#frq','Contractor'); pg.fill('#frr','General Contractor'); pg.wait_for_timeout(300)
    print('hits',pg.evaluate("document.querySelector('#frres .small').textContent"))
    pg.check('#frww'); pg.wait_for_timeout(300); print('whole word',pg.evaluate("document.querySelector('#frres .small').textContent"))
    pg.check('#frcs'); pg.wait_for_timeout(300); print('case',pg.evaluate("document.querySelector('#frres .small').textContent"))
    pg.click('#frgo'); pg.wait_for_timeout(600)
    print(pg.evaluate("__SS_DEBUG.projects[0].sections.filter(s=>['01 100','01 250'].includes(s.code)).map(s=>s.body)"))
    print('ERRORS',errs); b.close()
