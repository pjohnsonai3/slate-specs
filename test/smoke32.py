from playwright.sync_api import sync_playwright
APP='file:///home/claude/repo/slate-specs/slate-specs.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','R'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(500)
    print(pg.evaluate("[...document.querySelectorAll('#seclist .sec')].slice(0,8).map(e=>{var b=e.querySelector('.badge:last-child');return e.querySelector('.c').textContent+' '+b.textContent+' '+getComputedStyle(b).color})"))
    pg.screenshot(path='/tmp/red.png',clip={'x':220,'y':400,'width':300,'height':350}); print('ERRORS',errs); b.close()
