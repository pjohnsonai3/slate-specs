import os,json,shutil,tempfile
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[];seen=[]
FACTS={"manufacturer":"Acme Surfaces","productName":"Quartz Top","modelNumbers":["QT-30"],"category":"solid surface","suggestedSection":{"code":"12 360","title":"COUNTERTOPS"},"summary":"Engineered quartz slab.","properties":[{"name":"Thickness","value":"30 mm","standard":"","page":"1"},{"name":"Flame spread","value":"Class A","standard":"ASTM E84","page":"2"}],"standards":[{"org":"ASTM","number":"E84","page":"2"}],"dimensions":["126 x 63 in"],"materials":[],"finishes":["Polished"],"installation":[],"warranty":"10-year limited","certifications":[],"accessories":[],"unclear":["Edge profiles not stated"]}
SEC={"title":"COUNTERTOPS","body":"# GENERAL\n## SUMMARY\nN: Written from manufacturer literature; review.\n1: Section includes quartz surfacing.\n# PRODUCTS\n## MANUFACTURERS\n1: Basis of Design: Acme Surfaces, Quartz Top QT-30, 30 mm thick, 99 mm rating.\n1: Other acceptable manufacturers: [list manufacturers].\n# EXECUTION\n## INSTALLATION\n1: Install per manufacturer's instructions."}
def handler(route):
    body=json.loads(route.request.post_data); c=body['messages'][0]['content']
    txt=c if isinstance(c,str) else ' '.join(x.get('text','') for x in c if x['type']=='text')
    out=FACTS if 'manufacturer product literature' in txt else SEC; seen.append('facts' if out is FACTS else 'section')
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}],"stop_reason":"end_turn"}))
d=tempfile.mkdtemp(); f=os.path.join(d,'QT cut sheet.docx'); shutil.copy(os.environ.get('DOCX','s11.docx'),f)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Prod Test'); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:0'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300); pg.click('[data-act=tab][data-t=sections]')
    pg.click('[data-act=tab][data-t=products]'); pg.wait_for_timeout(200)
    pg.set_input_files('[data-prodfile]',f); pg.wait_for_timeout(200)
    pg.click('[data-act=prodread]'); pg.wait_for_selector('[data-act=prodwrite]',timeout=30000)
    print('facts shown:', 'Acme Surfaces' in pg.inner_text('.wrap'), '| unclear:', 'Edge profiles' in pg.inner_text('.wrap'), '| code:',pg.input_value('[data-prodf=code]'),pg.input_value('[data-prodf=title]'))
    pg.click('[data-act=prodwrite]'); pg.wait_for_selector('[data-act=prodapply]',timeout=30000)
    t=pg.inner_text('.wrap'); print('draft shown:', 'Basis of Design' in t, '| flagged 99:', '99' in t.split('Check these figures')[1][:300] if 'Check these figures' in t else 'no warn')
    n0=pg.evaluate("__SS_DEBUG.projects[0].sections.length")
    pg.click('[data-act=prodapply]'); pg.wait_for_timeout(400)
    r=pg.evaluate("(()=>{var p=__SS_DEBUG.projects[0];var s=p.sections.find(x=>x.code=='12 360');return [p.sections.length,s.body.slice(0,40),p.products.length,p.mods.length]})()")
    print('applied:',r)
    pg.click('[data-act=tab][data-t=export]'); pg.click('[data-act=modundo]'); pg.wait_for_timeout(300)
    print('undo restored:',pg.evaluate("(()=>{var p=__SS_DEBUG.projects[0];var s=p.sections.find(x=>x.code=='12 360');return s?s.body.slice(0,30):'removed'})()"))
    print('calls',seen,'errors:',errs)
