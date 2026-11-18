import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':1000}).new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Front Hotel'); pg.fill('[data-pf=number]','5100'); pg.fill('[data-pf=owner]','Front Owner LLC'); pg.fill('[data-pf=cityState]','Atlanta, GA')
    pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:1'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(200)
    pg.click('#seclist .sec >> nth=0'); pg.click('[data-act=gen]') if False else None
    # give two sections text via debug
    pg.evaluate("(function(){var s=__SS_DEBUG.projects[0].sections.slice(0,2);s.forEach(function(x){x.on=true;x.body='# GENERAL\\n## SUMMARY\\n1: Section includes '+x.title+'.'})})()")
    pg.click('[data-act=selpseudo][data-k=__cover]'); pg.wait_for_timeout(2500)
    fr=pg.frame_locator('#preview iframe')
    print('cover pages',fr.locator('#out > .pg').count(),'| title:',fr.locator('.cover h1').inner_text(),'| owner shown:',fr.locator('.cover .p').inner_text().count('Front Owner LLC'))
    print('mid panel:',pg.locator('#mid').inner_text()[:60].replace('\n',' '))
    pg.click('[data-act=selpseudo][data-k=__toc]'); pg.wait_for_timeout(2500)
    fr=pg.frame_locator('#preview iframe')
    print('toc pages',fr.locator('#out > .pg').count(),'| rows',fr.locator('.tr').count(),'| has TOC title',fr.locator('text=TABLE OF CONTENTS').count()>0)
    pg.click('#seclist .sec >> nth=0'); pg.wait_for_timeout(300); print('back to section preview:',pg.locator('#preview iframe').count()==0, pg.locator('#preview').inner_text()[:30].replace('\n',' '))
    b.close()
print('ERRORS',errs)
