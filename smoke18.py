import os,zipfile,re
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
errs=[]
def titles(o,acc):
    for x in o:
        if isinstance(x,list): titles(x,acc)
        else: acc.append(x.title)
    return acc
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1400,'height':1000},accept_downloads=True); ctx.add_init_script("window.print=function(){window.__printed=true}")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    for name,n in [('Mechanical Specs',3),('Electrical Specs',2)]:
        pp=ctx.new_page(); pp.set_content(''.join('<div style="page-break-after:always"><h1>CONSULT %s p%d</h1></div>'%(name,i+1) for i in range(n))); pp.pdf(path=name.replace(' ','_')+'.pdf'); pp.close()
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Cons Test'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:1'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(400); pg.click('[data-act=tab][data-t=sections]')
    pg.click('[data-act=tab][data-t=consultants]'); pg.wait_for_timeout(200)
    pg.set_input_files('[data-consfile]',['Mechanical_Specs.pdf','Electrical_Specs.pdf']); pg.wait_for_selector('[data-cf=title]',timeout=15000); pg.wait_for_timeout(500)
    print('rows:',pg.locator('[data-cf=title]').count(),'divs:',pg.evaluate("__SS_DEBUG.projects[0].consultants.map(c=>c.discipline+'|'+c.div+'|'+c.pages)"))
    pg.select_option('[data-cf=div][data-i="0"]','06'); pg.wait_for_timeout(200)   # force mid-manual insertion
    pg.fill('[data-cf=number][data-i="1"]','26 00 00'); pg.press('[data-cf=number][data-i="1"]','Tab'); pg.wait_for_timeout(300)
    # TOC in PDF and Word
    pg.click('[data-act=tab][data-t=export]'); pg.click('[data-act=pdf][data-scope=all]'); pg.wait_for_timeout(4000)
    fr=[f for f in pg.frames if f!=pg.main_frame][-1]; html=fr.content()
    toc=fr.evaluate("document.querySelector('#out')?document.querySelector('#out').innerText:''")
    print('PDF TOC lists consultants:', 'MECHANICAL SPECS' in toc.upper() and 'ELECTRICAL SPECS' in toc.upper(), '| pages col:', '3 pages' in toc and '2 pages' in toc)
    with pg.expect_download() as d: pg.click('[data-act=docx][data-scope=all]')
    d.value.save_as('s18.docx'); x=zipfile.ZipFile('s18.docx').read('word/document.xml').decode()
    print('Word TOC lists consultants:', 'MECHANICAL SPECS' in x and '26 00 00' in x)
    p2=ctx.new_page(); p2.set_content(html); p2.wait_for_timeout(500); p2.pdf(path='s18base.pdf',prefer_css_page_size=True,print_background=True,outline=True,tagged=True)
    nb=len(PdfReader('s18base.pdf').pages)
    pg.click('[data-act=tab][data-t=consultants]'); pg.set_input_files('[data-consbase]','s18base.pdf'); pg.wait_for_timeout(300)
    with pg.expect_download(timeout=60000) as d2: pg.click('#consmerge')
    d2.value.save_as('s18out.pdf'); out=PdfReader('s18out.pdf')
    pos={}
    for i,pgx in enumerate(out.pages):
        t=pgx.extract_text() or ''
        for k in ['CONSULT Mechanical','CONSULT Electrical','SECTION 06','SECTION 07','SECTION 08','SECTION 12']:
            if k in t and k not in pos: pos[k]=i
    print('pages',len(out.pages),'expected',nb+5,'positions',pos)
    ot=titles(out.outline,[]); print('merged bookmarks:',[t for t in ot if t.startswith('Merged')])
    print('errors',errs)
