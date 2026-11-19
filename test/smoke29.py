from playwright.sync_api import sync_playwright
APP='file:///home/claude/repo/slate-specs/slate-specs.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','F'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(300)
    st=lambda: pg.evaluate("(function(){var s=__SS_DEBUG.projects[0].sections.filter(s=>s.on!==false&&s.body.trim());return [s.length,s.filter(x=>x.status=='final').length]})()")
    print('before',st()); pg.click('[data-act=allfinal]'); pg.wait_for_timeout(400); print('after',st())
    pg.click('[data-act=allfinal]'); pg.wait_for_timeout(400); print('toggle back',st()); print('ERRORS',errs); b.close()
