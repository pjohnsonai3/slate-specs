from playwright.sync_api import sync_playwright
APP='file:///home/claude/repo/slate-specs/slate-specs.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Hotel X'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    body='# GENERAL\n## SUMMARY\n1: Plain paragraph one.\n1: Project is {{project.name}} and more.\n1: Hidden one ?(never=x)\n## SECOND\n2: Wrapped line starts here\n   and continues here.'
    pg.evaluate("b=>{var s=__SS_DEBUG.projects[0].sections.find(s=>s.code=='01 100');s.body=b}",body)
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(300); pg.click('text=Summary >> nth=0'); pg.wait_for_timeout(500)
    body_of=lambda: pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='01 100').body")
    print('editable',pg.evaluate("[...document.querySelectorAll('#preview .lve')].map(e=>e.className+'|'+e.textContent.slice(0,30))"))
    # static edit
    t=pg.locator('#preview .lve.sp-t').nth(0); t.click(); pg.keyboard.press('End'); pg.keyboard.type(' EDITED'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    print(repr(body_of()))
    # escape
    t=pg.locator('#preview .lve.sp-t').nth(0); t.click(); pg.keyboard.press('End'); pg.keyboard.type(' ZZZ'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    print('after esc has ZZZ:', 'ZZZ' in body_of())
    # dynamic
    d=pg.locator('#preview .lve.dyn'); print('dyn count',d.count()); d.first.click(); print('raw shown:',d.first.text_content()); pg.keyboard.press('End'); pg.keyboard.type(' DYN'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    # article title
    a=pg.locator('#preview .lve.sp-at').nth(0); a.click(); pg.keyboard.press('End'); pg.keyboard.type(' AREA'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    # part title
    pt=pg.locator('#preview .lve.pt').nth(0); pt.click(); pg.keyboard.press('End'); pg.keyboard.type(' PART'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    # wrapped
    w=pg.locator('#preview .lve.sp-t').nth(2+0); print('wrapped text:',w.text_content()); w.click(); pg.keyboard.press('End'); pg.keyboard.type(' Z'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    print(repr(body_of()))
    print('ERRORS',errs); b.close()
