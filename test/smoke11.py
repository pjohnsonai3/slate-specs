import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import zipfile,re,shutil
from playwright.sync_api import sync_playwright
errs=[]
def edit(src,dst):
    zi=zipfile.ZipFile(src); zo=zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED)
    for it in zi.infolist():
        d=zi.read(it.filename)
        if it.filename=='word/document.xml':
            x=d.decode()
            # 1) revise first text containing 'Paint'
            ps=re.findall(r'<w:p>.*?</w:p>',x,re.S)
            # revise: pick paragraph with numPr lvl 2 containing text
            cand=[q for q in ps if '<w:ilvl w:val="2"/>' in q and '<w:t' in q]
            q=cand[0]; t=re.search(r'<w:t xml:space="preserve">(.*?)</w:t>',q).group(1)
            nq=q.replace(t,t+' EDITED BY CONSULTANT',1); x=x.replace(q,nq,1)
            # 2) delete another
            q2=cand[1]; x=x.replace(q2,'',1)
            # 3) add a paragraph after the third
            q3=cand[2]; add=q3.replace(re.search(r'<w:t xml:space="preserve">(.*?)</w:t>',q3).group(1),'Brand new consultant requirement.',1)
            x=x.replace(q3,q3+add,1)
            d=x.encode(); print('revised:',t[:50])
        zo.writestr(it,d)
    zo.close()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':900}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Word Test'); pg.select_option('#npstart',index=1); pg.click('[data-act=createproj]'); pg.wait_for_timeout(400)
    pg.click('[data-act=tab][data-t=export]')
    with pg.expect_download() as d: pg.click('[data-act=docx][data-scope=all]')
    d.value.save_as('s11.docx'); edit('s11.docx','s11e.docx')
    # unchanged file -> no differences
    pg.set_input_files('[data-wordimp]','s11.docx'); pg.wait_for_timeout(800); print('unchanged:', 'No differences' in pg.inner_text('#modal'))
    pg.click('[data-act=closemodal]')
    before=pg.evaluate("JSON.stringify(__SS_DEBUG.projects[0].sections.map(s=>s.body))")
    pg.set_input_files('[data-wordimp]','s11e.docx'); pg.wait_for_timeout(800)
    print('hunks:',pg.locator('[data-wh]').count()); print(pg.inner_text('#modal')[:500]); pg.screenshot(path='s11_modal.png')
    pg.click('[data-act=wrapply]'); pg.wait_for_timeout(400)
    after=pg.evaluate("JSON.stringify(__SS_DEBUG.projects[0].sections.map(s=>s.body))")
    import json
    b1=json.loads(before); a1=json.loads(after)
    for x,y in zip(b1,a1):
        if x!=y:
            xl=x.split('\n'); yl=y.split('\n')
            import difflib
            print('\n'.join(l for l in difflib.unified_diff(xl,yl,lineterm='',n=0) if not l.startswith(('---','+++','@@'))))
    # re-import same edited file -> now no differences
    pg.click('[data-act=tab][data-t=export]'); pg.set_input_files('[data-wordimp]','s11e.docx'); pg.wait_for_timeout(800)
    print('after apply, reimport:', pg.locator('[data-wh]').count(),'hunks')
    print('ERRORS',errs)
