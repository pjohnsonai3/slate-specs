import os,json
APP='file://'+os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slate-specs.html'))
from playwright.sync_api import sync_playwright
errs=[];calls=[]
def handler(route):
    body=json.loads(route.request.post_data); txt=json.dumps(body); calls.append('cover' if 'COVER PAGE' in txt else 'sections')
    if 'COVER PAGE' in txt:
        out={"name":"Peachtree Boutique Hotel","number":"26-014","owner":"Peachtree Hospitality LLC","address":"100 Peachtree St","cityState":"Atlanta, GA","phase":"Permit Set","issueDate":"October 3, 2026","architect":"ai3, Inc.","cm":"BuildCo","mep":"","structural":"","interior":"","code":"Georgia State Minimum Standard Codes","contractForm":"AIA A201-2017"}
    else:
        out={"sections":[{"code":"01 001","title":"TABLE OF CONTENTS","body":"# GENERAL\n## SUMMARY\n1: Toc.","partial":False},{"code":"09 260","title":"GYPSUM BOARD ASSEMBLIES","body":"# GENERAL\n## SUMMARY\n1: Peachtree Hotel uses 5/8 inch Type X board by USG.","partial":False},{"code":"09 910","title":"PAINTING","body":"# GENERAL\n## SUMMARY\n1: Paint.","partial":False}]}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({"content":[{"type":"text","text":json.dumps(out)}],"stop_reason":"end_turn"}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1500,'height':1000}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.route('https://api.anthropic.com/**',handler); pg.route('https://fonts.googleapis.com/**',lambda r:r.abort()); pg.route('https://*.supabase.co/**',lambda r:r.abort())
    pg.goto(APP); pg.wait_for_timeout(1200)
    if pg.locator('#gate').count(): pg.click('[data-act=offline]')
    pg.evaluate("localStorage.setItem('db_apikey_anthropic','sk-test')")
    pg.click('[data-act=pmopen]'); pg.set_input_files('#pmfile','s11.docx')
    pg.wait_for_selector('[data-pmi]',timeout=60000); pg.wait_for_timeout(300)
    print('calls',calls)
    print('fields:',pg.input_value('#pm-name'),'|',pg.input_value('#pm-owner'),'|',pg.input_value('#pm-code'),'|',pg.input_value('#pm-ptype'))
    print('sections listed',pg.locator('[data-pmi]').count(),'toc unchecked:',not pg.is_checked('[data-pmi="0"]'))
    pg.fill('#pm-number','26-014X'); pg.click('#pmcreate'); pg.wait_for_timeout(400)
    r=pg.evaluate("(function(){var p=__SS_DEBUG.projects[0];return [p.name,p.number,p.cityState,p.phase,p.sections.map(function(s){return s.code+'|'+s.questions.length+'|'+s.on})]})()")
    print('project:',r)
    print('body kept as written:',pg.evaluate("__SS_DEBUG.projects[0].sections.filter(function(s){return s.code==='09 260'})[0].body.indexOf('Peachtree Hotel uses 5/8')>=0"))
    print('lands overview:',pg.locator('text=What to do next').count()==1)
    pg.click('[data-act=tab][data-t=sections]'); pg.wait_for_timeout(200)
    print('no stale-library badge:',pg.locator('text=Library updated').count()==0)
    b.close()
print('ERRORS',errs)
