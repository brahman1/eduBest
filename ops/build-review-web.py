"""Build Linux web with review rewrites; never contacts either database."""
from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED
import subprocess,tarfile,json,hashlib
root=Path(__file__).resolve().parents[1]
target=root/'release/EduBest-Demonstration-Web-20261029.zip'
if target.exists():raise RuntimeError('Use a new release name rather than overwrite an existing archive')
prefix='edubest-review-web-20261029'
cmd=['rtk','proxy','docker','build','--target','web-runtime','--build-arg','EDUBEST_PUBLIC_SITE_ONLY=false','--build-arg','EDUBEST_API_ORIGIN=https://demo-api.edubest.dz','-f','ops/Dockerfile.octenium','--output','type=tar,dest=-','.']
entries={};links={}
proc=subprocess.Popen(cmd,cwd=root,stdout=subprocess.PIPE)
with tarfile.open(fileobj=proc.stdout,mode='r|') as archive:
    for member in archive:
        name=member.name.removeprefix('./')
        if not name.startswith('runtime/web/'):continue
        if member.islnk():links[name]=member.linkname.removeprefix('./');continue
        if member.issym():raise RuntimeError('Nonportable symbolic link')
        if member.isfile():entries[name]=archive.extractfile(member).read()
if proc.wait():raise RuntimeError('Linux build failed')
while links:
    available=[n for n,v in links.items() if v in entries]
    if not available:raise RuntimeError('Unresolved build link')
    for name in available:entries[name]=entries[links.pop(name)]
profile=json.loads(entries['runtime/web/public.json']);profile.update(api_origin='https://demo-api.edubest.dz',web_url='https://demo.edubest.dz')
entries['runtime/web/public.json']=(json.dumps(profile,indent=2)+'\n').encode()
routes=json.loads(entries['runtime/web/web/.next/routes-manifest.json'])
rewrite=routes['rewrites']; all_routes=rewrite if isinstance(rewrite,list) else sum(rewrite.values(),[])
api_routes=[r for r in all_routes if r['source']=='/api/:path*']
assert len(api_routes)==1 and api_routes[0]['destination']=='https://demo-api.edubest.dz/api/:path*'
for name in ('runtime/web/web/server.js','runtime/web/web/.next/routes-manifest.json','runtime/web/web/.next/required-server-files.json'):
    assert b'https://api.edubest.dz' not in entries[name],name
assert not any(Path(n).name in ('.env','api.env','credentials.private.json') for n in entries)
manifest={'environment':'review-only','rewrites':api_routes,'linux_build':True,'sha256':{n:hashlib.sha256(b).hexdigest() for n,b in entries.items()}}
entries['MANIFEST.json']=(json.dumps(manifest,indent=2)+'\n').encode()
with ZipFile(target,'x',ZIP_DEFLATED,compresslevel=6) as z:
    for name,data in entries.items():
        i=ZipInfo(prefix+'/'+name);i.create_system=3;i.external_attr=0o100644<<16;i.compress_type=ZIP_DEFLATED;z.writestr(i,data)
    i=ZipInfo('edubest-review-20261029/applications/edubest-review-web/app.js');i.create_system=3;i.external_attr=0o100644<<16
    z.writestr(i,f'"use strict";\nrequire("/home/ggcsckht/{prefix}/runtime/web/entry.cjs");\n'.encode())
with ZipFile(target) as z:assert z.testzip() is None
target.with_suffix('.zip.sha256.txt').write_text(hashlib.sha256(target.read_bytes()).hexdigest()+'  '+target.name+'\n')
(root/'verification/review-web-build-20261029.json').write_text(json.dumps({'zip':str(target),'review_rewrites_verified':True,'production_api_absent_from_runtime_configuration':True},indent=2)+'\n')
print('Review web verified:',target)
