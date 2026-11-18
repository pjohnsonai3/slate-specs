import os
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
import json,time
from playwright.sync_api import sync_playwright
errs=[]; store={}; log=[]; fail={'get':False}
REF='qzozlnurhlcqsxcydagb'
def rest(route):
    req=route.request; u=req.url
    if '/auth/' in u: return route.fulfill(status=200,content_type='application/json',body='{}')
    if req.method=='GET':
        if fail['get']: return route.fulfill(status=500,content_type='application/json',body='{"message":"boom"}')
        return route.fulfill(status=200,content_type='application/json',body=json.dumps([{'key':k,'data':v} for k,v in store.items()]))
    if req.method=='POST':
        for r in json.loads(req.post_data): store[r['key']]=r['data']; log.append('up '+r['key'])
        return route.fulfill(status=201,content_type='application/json',body='[]')
    if req.method=='DELETE':
        import urllib.parse
        q=urllib.parse.unquote(u); 
        for k in list(store):
            if '"'+k+'"' in q or k in q: del store[k]; log.append('del '+k)
        return route.fulfill(status=204,body='')
    route.fulfill(status=200,body='[]')
sess={'access_token':'a.b.c','refresh_token':'r','expires_in':99999,'expires_at':int(time.time())+999999,'token_type':'bearer','user':{'id':'u1','email':'t@ai3.com'}}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1400,'height':900}); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://*.supabase.co/**',rest); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    ctx.add_init_script("localStorage.setItem('sb-%s-auth-token', %s)"%(REF,json.dumps(json.dumps(sess))))
    pg.goto(APP); pg.wait_for_timeout(2000)
    print('pill:',pg.inner_text('#syncpill'))
    for n in ('A','B'):
        pg.click('[data-act=newproj]'); pg.fill('[data-pf=name]','Proj '+n); pg.click('[data-act=wiznext]'); pg.click('[data-act=wiznext]'); pg.select_option('#npstart',value='s:0'); pg.click('[data-act=createproj]'); pg.wait_for_timeout(300); pg.click('[data-act=tab][data-t=sections]')
        pg.click('nav [data-act=nav][data-v=projects], .ni >> nth=0'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(2500)
    print('keys:',sorted(store)); 
    # edit only A
    log.clear()
    pg.click('[data-act=open] >> nth=0'); pg.click('[data-act=tab][data-t=sections]')
    pg.wait_for_timeout(300); pg.click('[data-act=tab][data-t=info]'); pg.wait_for_timeout(200)
    pg.fill('[data-pf=name]','Edited name'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(2500); print('after edit uploads:',log)
    # old-format migration: new context with only ss_projects in cloud
    old=[store[k] for k in store if k.startswith('ss_proj_')]
    store.clear(); store['ss_projects']=old
    pg2=ctx.new_page(); pg2.on('pageerror',lambda e:errs.append(str(e)))
    pg2.route('https://*.supabase.co/**',rest); pg2.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    log.clear(); pg2.goto(APP); pg2.wait_for_timeout(2500)
    print('migrated keys:',sorted(store), 'projects:',pg2.evaluate("__SS_DEBUG.projects.length"))
    # failed pull: blocked gate, no uploads
    fail['get']=True; log.clear()
    pg3=ctx.new_page(); pg3.on('pageerror',lambda e:errs.append(str(e)))
    pg3.route('https://*.supabase.co/**',rest); pg3.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg3.goto(APP); pg3.wait_for_timeout(2500)
    print('gate shown:',pg3.locator('#gate').count(),'uploads:',log)
    pg3.screenshot(path='s8_gate.png')
    print('ERRORS',errs)
