#!/usr/bin/env python3
"""Validate brand-only public release. Preserve canonical routes and fail on stale content."""
import json, os
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlsplit
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
PAGES=["/","/darkhast-melk/","/sabt-file/","/bazdid-360/","/tour/","/daftar-amlak-karaj/","/kharid-apartman-rajaei-shahr/","/forosh-melk-karaj/","/rahnama-bazdid-apartman/","/privacy.html"]
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.canon=[]; self.refs=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='link' and a.get('rel')=='canonical': self.canon.append(a.get('href'))
        for k in ('href','src'):
            if a.get(k,'').startswith('/') and not a[k].startswith('//'): self.refs.append(urlsplit(a[k]).path)
def target(path):
    p=ROOT/path.lstrip('/')
    return p/'index.html' if p.is_dir() else p
def main():
    assert json.loads((ROOT/'properties.json').read_text())==[], 'Public property data must be empty'
    for path in PAGES:
        p=target(path); assert p.is_file(), str(p)
        parser=Links(); parser.feed(p.read_text())
        assert parser.canon==['https://amlakadak.ir'+path], (path,parser.canon)
        for ref in parser.refs:
            if ref.startswith('/assets/') or ref.endswith(('.js','.css')): assert target(ref).is_file(), (path,ref)
            elif ref not in ['/api/submit'] and ref.startswith(('/p/','/files/','/tour/adk-06/')): raise RuntimeError((path,ref))
    urls=''.join('<url><loc>https://amlakadak.ir'+p+'</loc></url>\n' for p in PAGES)
    (ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls+'</urlset>\n')
    if os.environ.get('CONTEXT') in ('deploy-preview','branch-deploy'):
        hp=ROOT/'_headers'; h=hp.read_text()
        if 'X-Robots-Tag: noindex, nofollow, noarchive' not in h: hp.write_text(h.replace('/*\n','/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n',1))
    if os.environ.get('NETLIFY'): (ROOT/'build-info.txt').write_text('brand-only '+datetime.now(timezone.utc).isoformat()+'\n')
    print(f'Validated {len(PAGES)} canonical pages; no public listings.')
if __name__=='__main__': main()
