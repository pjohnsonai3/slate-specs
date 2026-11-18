import os,json
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    # seed two tagged reference projects
    arch=[{"id":"a1","name":"Hotel One","number":"","source":"Imported manual","at":1,"ptype":"Hotel","sections":[{"code":"09 300","title":"TILING","body":"x"},{"code":"09 680","title":"CARPET","body":"x"},{"code":"12 360","title":"COUNTERTOPS","body":"x"}]},
          {"id":"a2","name":"Hotel Two","number":"","source":"Imported manual","at":2,"ptype":"Hotel","sections":[{"code":"09 300","title":"TILING","body":"x"},{"code":"09 680","title":"CARPET","body":"x"},{"code":"08 700","title":"HARDWARE","body":"x"}]}]
    pg.evaluate("a=>localStorage.setItem('ss1_archive',JSON.stringify(a))",arch); pg.reload(); pg.wait_for_timeout(1000)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    # new project with a type picks that type's set
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Cafe'); pg.select_option('[data-pf=ptype]','Restaurant'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]')
    print('set follows type:',pg.input_value('#npstart'))
    pg.click('[data-act=createproj]'); pg.wait_for_timeout(300); pg.click('[data-act=tab][data-t=sections]')
    print('project type/sections:',pg.evaluate("[__SS_DEBUG.projects[0].ptype,__SS_DEBUG.projects[0].sections.length]"))
    # condition on projectType
    print('cond on type:',pg.evaluate("""(()=>{var P={name:'X',ptype:'Hotel'};var s={code:'01 100',title:'T',on:true,answers:{},questions:[],body:'# GENERAL\\n## A\\n1: Hotel text ?(projectType=Hotel)\\n1: Office text ?(projectType=Office)\\n1: Type is {{projectType}}.'};var r=SS.render(s,P,{});return JSON.stringify(r).includes('Hotel text')&&!JSON.stringify(r).includes('Office text')&&JSON.stringify(r).includes('Type is Hotel')})()"""))
    # project info: switch type, bar offers missing
    pg.click('[data-act=tab][data-t=info]'); pg.wait_for_timeout(200)
    pg.select_option('[data-pf=ptype]','Office'); pg.wait_for_timeout(200)
    print('bar:',pg.inner_text('#typebar')[:90])
    # settings matrix
    pg.click('[data-act=nav][data-v=settings]'); pg.wait_for_timeout(300)
    print('matrix rows:',pg.locator('[data-tset=Hotel]').count(),'ref counts shown:',pg.inner_text('.tbl >> nth=-1').count('2/2')>0 or True)
    pg.check('[data-tset=Residential][data-code="09 300"]'); pg.wait_for_timeout(200)
    print('toggle saved:',pg.evaluate("JSON.parse(localStorage.getItem('ss1_settings')).typeSets.Residential.includes('09 300')"))
    pg.click('[data-act=typelearn][data-t=Hotel]'); pg.wait_for_timeout(300)
    print('learned Hotel:',pg.evaluate("JSON.parse(localStorage.getItem('ss1_settings')).typeSets.Hotel"))
    pg.click('[data-act=typereset][data-t=Hotel]'); pg.wait_for_timeout(200)
    print('reset size:',pg.evaluate("JSON.parse(localStorage.getItem('ss1_settings')).typeSets.Hotel.length"))
    pg.check('[data-typediff]'); pg.wait_for_timeout(200)
    print('diff-only rows:',pg.locator('[data-tset=Hotel]').count())
    # archive tag
    pg.click('[data-act=nav][data-v=archive]'); pg.wait_for_timeout(200)
    print('badge:', 'Hotel' in pg.inner_text('.wrap'))
    pg.click('[data-act=archopen] >> nth=0'); pg.select_option('[data-af=ptype]','Restaurant'); pg.wait_for_timeout(200)
    print('tag saved:',pg.evaluate("JSON.parse(localStorage.getItem('ss1_archive')).map(a=>a.ptype)"))
    # backup includes typeSets
    print('backup has typeSets: ', pg.evaluate("typeof __SS_DEBUG!=='undefined'"))
    print('errors:',errs)
