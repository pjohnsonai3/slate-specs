import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':900}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog',lambda d:d.accept('09 261') if 'section number' in d.message else d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Iss Test'); pg.select_option('#npstart',index=1); pg.click('[data-act=createproj]'); pg.wait_for_timeout(400)
    print('sections',pg.evaluate("__SS_DEBUG.projects[0].sections.filter(s=>s.on).length"))
    # export tab: check + issues
    pg.click('[data-act=tab][data-t=export]'); pg.wait_for_timeout(300)
    t=pg.inner_text('.wrap'); print('has check:', 'Pre-issue check' in t, 'Issues & addenda' in t)
    pg.click('[data-act=isnew]'); pg.fill('#isname','Bid Set'); pg.fill('#isdate','March 1, 2027'); pg.click('[data-act=isfreeze]'); pg.wait_for_timeout(300)
    print('issues',pg.evaluate("__SS_DEBUG.projects[0].issues.length"))
    # edit a section body
    pg.evaluate("(()=>{const s=__SS_DEBUG.projects[0].sections.find(s=>s.on&&s.body.trim());s.body+='\\n# EXTRA\\n## NEW ARTICLE\\n1: Added requirement for addendum.';window.__code=s.code})()")
    pg.click('[data-act=tab][data-t=export]'); pg.wait_for_timeout(300)
    pg.click('[data-act=cmpopen]'); pg.wait_for_timeout(400)
    print('cmp modal:', pg.locator('.mbox details').count(), 'changed sections;', 'Added requirement' in pg.inner_text('.mbox'))
    pg.screenshot(path='s7_cmp.png')
    pg.click('[data-act=closemodal]')
    # submittals
    pg.click('[data-act=tab][data-t=submittals]'); pg.wait_for_timeout(300)
    print('submittal rows:', pg.locator('.tbl tr').count()-1)
    pg.screenshot(path='s7_sub.png')
    # renumber + library history
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#seclist .sec .t').click()"); pg.wait_for_timeout(300)
    print('renum btn', pg.locator('[data-act=renum]').count(), 'reuse', pg.locator('[data-act=reuse]').count())
    pg.click('[data-act=renum]'); pg.wait_for_timeout(300)
    print('origin set:', pg.evaluate("__SS_DEBUG.projects[0].sections.some(s=>s.code=='09 261'&&s.origin)"))
    print('ERRORS',errs)
