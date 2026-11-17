import re
import os
ROOT=os.path.dirname(os.path.abspath(__file__))
vd=lambda f:open(os.path.join(ROOT,'vendor',f),encoding='utf8').read()
# supabase-js, fflate and the ai3 diagnostic block are vendored from STEVE so this repo builds on its own
sup=vd('supabase.block.html'); diag=vd('diagnostic.block.html'); ff=vd('fflate.block.html')
rd=lambda f:open(os.path.join(ROOT,'src',f),encoding='utf8').read()
appjs=rd('app.js').replace('/*__SOURCES__*/',rd('sources.inc.js')).replace('/*__EXTRAS__*/',rd('extras.inc.js'))
head='''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Slate Specs — an ai3 product</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script>try{if(localStorage.getItem('ai3_theme')==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}window.__AI3_LOGO="'''+rd('ai3logo.txt').strip()+'''";</script>\n<style>'''+rd('app.css')+'''</style></head>
<body><div id="app"></div>
<!-- Supabase client, fflate and pdf-lib are inlined so there is no CDN dependency -->
'''
html=(head+sup+'\n'+diag+'\n'+ff+'\n<script>/* pdf-lib (drawing-set page splitting) */\n'+rd('pdf-lib.min.js')+'\n</script>\n<script>\n'
      +rd('engine.js')+'\n'+rd('seed.js')+'\n'+rd('docx.js')+'\n'+appjs+'\n</script></body></html>')
open(os.path.join(ROOT,'slate-specs.html'),'w',encoding='utf8').write(html)
print(len(html))
