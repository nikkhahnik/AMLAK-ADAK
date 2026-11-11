from pathlib import Path
import sys,html,re
from urllib.parse import urlparse
p=Path(__file__).resolve().parent
if len(sys.argv)!=2: raise SystemExit('Usage: python finalize_seo.py https://YOUR-REAL-DOMAIN.ir')
base=sys.argv[1].rstrip('/')
u=urlparse(base)
if u.scheme!='https' or not u.hostname or u.username or u.password: raise SystemExit('Only HTTPS public domain is allowed')
for filename in ['index.html','property.html','privacy.html']:
 f=p/filename;s=f.read_text(encoding='utf8');s=re.sub(r'<link rel="canonical" href="[^"]*">','',s)
 url=base+'/' + {'index.html':'','property.html':'p/adk-019'}.get(filename,filename)
 s=s.replace('</head>',f'<link rel="canonical" href="{html.escape(url,quote=True)}"></head>')
 s=re.sub(r'<meta property="og:url" content="[^"]*">','',s)
 s=s.replace('</head>',f'<meta property="og:url" content="{html.escape(url,quote=True)}"></head>')
 f.write_text(s,encoding='utf8')
(p/'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /qr.html\nSitemap: '+base+'/sitemap.xml\n',encoding='utf8')
pages=['','p/adk-019','privacy.html']
(p/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join('<url><loc>'+html.escape(base+'/'+x)+'</loc></url>\n' for x in pages)+'</urlset>\n',encoding='utf8')
print('SEO files updated:',base)
