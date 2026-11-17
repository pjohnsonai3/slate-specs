import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json
from playwright.sync_api import sync_playwright
errs=[];seen=[]
FIN={"finishes":[{"tag":"P-1","category":"Paint","description":"Wall paint","manufacturer":"Benjamin Moore","product":"Regal","color":"","finish":"Eggshell","size":"","location":""}],
"hardwareSets":[{"set":"HW-1","description":"Guest room entry","doors":"101-120","items":[{"qty":"3","item":"Hinges","manufacturer":"Hager","model":"BB1279","function":"","finish":"US26D","notes":""},{"qty":"1","item":"Lockset","manufacturer":"Schlage","model":"L9050","function":"Storeroom","finish":"626","notes":""}]}],
"hardwareNotes":["Standard finish US26D; keyed to Owner's master key system"],"otherSpecs":[{"topic":"Millwork","text":"Plastic laminate: Wilsonart"}],"notes":[]}
def handler(route):
    body=json.loads(route.request.post_data); c=body['messages'][0]['content']
    txt=c if isinstance(c,str) else ' '.join(x.get('text','') for x in c if x['type']=='text')
    if 'finish and product specifications' in txt: out=FIN
    elif 'questionnaire' in txt: seen.append(txt); out={"answers":{}}
    else: out={}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}],"stop_reason":"end_turn"}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':900}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','HW Test'); pg.select_option('#npstart',index=0); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.click('[data-act=tab][data-t=sources]')
    pg.set_input_files('[data-upload=finish]',['smoke.docx']); pg.wait_for_timeout(2500)
    print('card:', pg.locator('details summary, .src').first.inner_text()[:160].replace('\n',' '))
    d=pg.evaluate("(()=>{const p=__SS_DEBUG.projects[0];const s=p.sources[0].data;return [s.hardwareSets.length,s.hardwareNotes.length,s.otherSpecs.length]})()"); print('stored',d)
    # add 08 700 section and open it
    pg.evaluate("""(()=>{const p=__SS_DEBUG.projects[0];const L=__SS_DEBUG.library;p.sections.push({id:'x1',code:'08 700',title:'Door Hardware',on:true,body:'# GENERAL\\n## SUMMARY\\n1: Hardware.\\n# PRODUCTS\\n## MATERIALS\\n1: Hinges.\\n# EXECUTION\\n## INSTALLATION\\n1: Install.',questions:[],answers:{},status:'draft'});__SS_DEBUG.ui.secId='x1';})()""")
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#seclist .sec[data-code=\"08 700\"] .t').click()"); pg.wait_for_timeout(300)
    print('insert btn:', pg.locator('[data-act=inshw]').count())
    pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='08 700').body='# GENERAL\\n## SUMMARY\\n1: Hardware.\\n# PRODUCTS\\n## MATERIALS\\n1: Hinges.\\n# EXECUTION\\n## INSTALLATION\\n1: Install.'"); pg.click('[data-act=inshw]'); pg.wait_for_timeout(300)
    print(pg.evaluate("__SS_DEBUG.projects[0].sections.find(s=>s.code=='08 700').body"))
    print('ERRORS',errs)
