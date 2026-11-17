import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json,base64
from playwright.sync_api import sync_playwright
errs=[];kinds=[]
HW={"finishes":[],"hardwareSets":[{"set":"HW-2","description":"Stair","doors":"S1","items":[{"qty":"1","item":"Exit device","manufacturer":"Von Duprin","model":"99","function":"","finish":"US32D","notes":""}]}],"hardwareNotes":["Keyed alike"],"otherSpecs":[],"notes":[]}
FIN={"finishes":[{"tag":"P-1","category":"Paint","description":"Wall","manufacturer":"BM","product":"Regal","color":"","finish":"","size":"","location":""}],"hardwareSets":[],"hardwareNotes":[],"otherSpecs":[],"notes":[]}
def handler(route):
    body=json.loads(route.request.post_data); c=body['messages'][0]['content']
    txt=c if isinstance(c,str) else ' '.join(x.get('text','') for x in c if x['type']=='text')
    hw='THIS FILE IS A DOOR HARDWARE DOCUMENT' in txt; kinds.append('hw' if hw else 'fin')
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(HW if hw else FIN)}],"stop_reason":"end_turn"}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':900}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://*/**',lambda r: r.abort() if 'anthropic' not in r.request.url else r.continue_())
    pg.route('https://api.anthropic.com/**',handler)
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','DZ'); pg.select_option('#npstart',index=0); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300)
    pg.click('[data-act=tab][data-t=sources]')
    print('dropzones',pg.locator('[data-dz]').count())
    b64=base64.b64encode(open('smoke.docx','rb').read()).decode()
    pg.evaluate("""(b64)=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
      const dt=new DataTransfer();dt.items.add(new File([u],'finishes.docx'));const z=document.querySelector('[data-dz=finish]');
      z.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
      z.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}""",b64)
    pg.wait_for_timeout(2500)
    pg.evaluate("""(b64)=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
      const dt=new DataTransfer();dt.items.add(new File([u],'hardware.docx'));const z=document.querySelector('[data-dz=hardware]');
      z.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}""",b64)
    pg.wait_for_timeout(2500)
    print(pg.evaluate("__SS_DEBUG.projects[0].sources.map(s=>[s.kind,s.name,(s.data.hardwareSets||[]).length,(s.data.finishes||[]).length])"), kinds)
    pg.screenshot(path='src_tab.png'); print('ERRORS',errs)
