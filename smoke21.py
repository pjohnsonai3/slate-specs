import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1400,'height':1000}).new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=nav][data-v=help]'); print('pages',pg.locator('[data-act=helppage]').count(),pg.inner_text('#helpbody h2'))
    pg.click('[data-act=helppage][data-k=consult]'); print('page',pg.inner_text('#helpbody h2'))
    pg.fill('[data-helpq]','submittal'); print('search',pg.locator('[data-act=helppage]').count(),pg.input_value('[data-helpq]'))
    pg.fill('[data-helpq]','zzzz'); print('none',pg.locator('[data-act=helppage]').count())
    pg.fill('[data-helpq]','')
    pg.click('[data-act=nav][data-v=settings]'); pg.keyboard.press('Shift+Slash'); pg.click('[data-act=helpfull]'); print('contextual',pg.inner_text('#helpbody h2'))
    b.close()
print('ERRORS',errs)
