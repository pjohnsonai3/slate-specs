import json
from playwright.sync_api import sync_playwright
APP='file:///home/claude/repo/slate-specs/slate-specs.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    pg.on('pageerror',lambda e:print('ERR',e)); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    arch=[{'id':'A1','name':'Old Hotel 2023','fromId':'x','at':1,'sections':[{'code':'09 910','title':'Painting','body':'# GENERAL\n## SUMMARY\n1: Paint it well.'},{'code':'10 440','title':'Signage','body':'# GENERAL\n## SUMMARY\n1: Signs.'}]}]
    pg.evaluate("a=>{localStorage.setItem('ss1_archive',JSON.stringify(a))}",arch); pg.reload(); pg.wait_for_timeout(800)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','NEW'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(300)
    pg.click('[data-act=reuse]'); pg.wait_for_timeout(300)
    print('opts',pg.evaluate("[...document.querySelectorAll('[data-ruse-src] option')].map(o=>o.textContent)"))
    pg.fill('#rusq','paint'); pg.wait_for_timeout(300)
    print('rows',pg.evaluate("[...document.querySelectorAll('[data-ruse]')].map(c=>c.dataset.ruse)"))
    pg.check('[data-ruse="09 910"]'); pg.click('[data-act=rusgo]'); pg.wait_for_timeout(500)
    print('has',pg.evaluate("__SS_DEBUG.projects.find(p=>p.name=='NEW').sections.filter(s=>s.code=='09 910').map(s=>[s.title,s.body.slice(0,30),s.status])"))
    print("ERRORS []")
