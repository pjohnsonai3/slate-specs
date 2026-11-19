from playwright.sync_api import sync_playwright
APP='file:///home/claude/repo/slate-specs/slate-specs.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','U'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(500)
    first=lambda: pg.locator('#preview .lve.sp-t:not(.dyn)').first.text_content()
    orig=first(); print('orig',orig[:40])
    t=pg.locator('#preview .lve.sp-t:not(.dyn)').first; t.click(); pg.keyboard.press('End'); pg.keyboard.type(' CHANGED'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    print('edited',first()[-40:], pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='01 100').body.includes('CHANGED')"))
    print('btn in preview header', pg.locator('.col.right [data-act=histundo]').count())
    pg.click('.col.right [data-act=histundo]'); pg.wait_for_timeout(500)
    print('undone body clean', pg.evaluate("!__SS_DEBUG.projects[0].sections.find(s=>s.code=='01 100').body.includes('CHANGED')")); print('ERRORS',errs); b.close()
