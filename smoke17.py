import os,json
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
errs=[]
def outline_titles(o,acc):
    for x in o:
        if isinstance(x,list): outline_titles(x,acc)
        else: acc.append(x.title)
    return acc
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1400,'height':900},accept_downloads=True); ctx.add_init_script("window.print=function(){window.__printed=true}")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Merge Test'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:1'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(400); pg.click('[data-act=tab][data-t=sections]')
    pg.click('[data-act=tab][data-t=export]')
    pg.click('[data-act=pdf][data-scope=all]'); pg.wait_for_timeout(4000)
    fr=[f for f in pg.frames if f!=pg.main_frame][-1]; html=fr.content()
    p2=ctx.new_page(); p2.set_content(html); p2.wait_for_timeout(500); p2.pdf(path='s17base.pdf',prefer_css_page_size=True,print_background=True,outline=True,tagged=True)
    for name,n in [('AIA A201-2017 General Conditions',3),('Owner Agreement A101',2),('Appendix Notes',1)]:
        pp=ctx.new_page(); pp.set_content(''.join('<div style="page-break-after:always"><h1>ATTACH %s p%d</h1></div>'%(name,i+1) for i in range(n))); pp.pdf(path=name.replace(' ','_')+'.pdf'); pp.close()
    base=PdfReader('s17base.pdf'); nb=len(base.pages); ob=len(outline_titles(base.outline,[]))
    print('base pages',nb,'outline entries',ob)
    pg.bring_to_front(); pg.click('[data-act=mergeopen]'); pg.wait_for_selector('select, [data-mgbase]',timeout=20000); pg.wait_for_timeout(1500)
    pg.set_input_files('[data-mgbase]','s17base.pdf'); pg.wait_for_timeout(600)
    pg.set_input_files('[data-mgdocs]',['AIA_A201-2017_General_Conditions.pdf','Owner_Agreement_A101.pdf','Appendix_Notes.pdf']); pg.wait_for_timeout(500)
    print('guessed positions:',pg.evaluate("[...document.querySelectorAll('[data-mgpos]')].map(s=>s.options[s.selectedIndex].text)"))
    print('page note:', 'Slate expects' in pg.inner_text('#modal'))
    with pg.expect_download(timeout=60000) as d: pg.click('[data-act=mgrun]')
    d.value.save_as('s17out.pdf')
    out=PdfReader('s17out.pdf'); print('merged pages',len(out.pages),'expected',nb+3+2+1)
    pos={}
    for i,pgx in enumerate(out.pages):
        t=pgx.extract_text() or ''
        for key in ['ATTACH AIA','ATTACH Owner','ATTACH Appendix','TABLE OF CONTENTS','DIVISION 01','SUMMARY']:
            if key in t and key not in pos: pos[key]=i
    print('positions',pos)
    ot=outline_titles(out.outline,[]); print('outline',len(ot),'merged entries',[t for t in ot if t.startswith('Merged')],'orig kept',len(ot)-3>=ob)
    print('errors',errs)
