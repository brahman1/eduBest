"""Reuse verified Linux dependencies, replacing compiled JS only; no production mutation."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json

root=Path(__file__).resolve().parents[1]
source=root/'release/EduBest-Octenium-MAJ-20261027-r3.zip'
prefix='edubest-review-20261029'
target=root/f'release/EduBest-Demonstration-Octenium-20261029-r4.zip'
with ZipFile(source) as z:
    entries={n.split('/',1)[1]:z.read(n) for n in z.namelist() if '/runtime/' in n and not n.endswith('/')}
# Never reuse production compile-time API rewrites in the sandbox web runtime.
web_archive=root/'release/EduBest-Demonstration-Web-20261029.zip'
if not web_archive.exists():raise RuntimeError('Build the review-only Linux web runtime first: ops/build-review-web.py')
entries={n:b for n,b in entries.items() if not n.startswith('runtime/web/')}
with ZipFile(web_archive) as z:
    for name in z.namelist():
        if name.startswith('edubest-review-web-20261029/runtime/web/') and not name.endswith('/'):
            entries[name.split('/',1)[1]]=z.read(name)
routes=json.loads(entries['runtime/web/web/.next/routes-manifest.json'])
rewrite=routes['rewrites']; all_routes=rewrite if isinstance(rewrite,list) else sum(rewrite.values(),[])
assert any(r.get('source')=='/api/:path*' and r.get('destination')=='https://demo-api.edubest.dz/api/:path*' for r in all_routes)
assert b'https://api.edubest.dz' not in entries['runtime/web/web/.next/routes-manifest.json']
for p in (root/'api/dist').glob('*.js'):
    entries['runtime/api/api/dist/'+p.name]=p.read_bytes()
for base in ('runtime/api/shared/','runtime/api/node_modules/@edubest/shared/'):
    entries[base+'review-policy.cjs']=(root/'shared/review-policy.cjs').read_bytes()
for name in ('demo-config.mjs','demo.mjs','demo-showcase.mjs','prepare-review.mjs','review-diagnostics.mjs'):
    entries['runtime/api/scripts/'+name]=(root/'scripts'/name).read_bytes()
entries['runtime/api/ops/review-server.cjs']=(root/'ops/review-server.cjs').read_bytes()
profile=json.loads(entries['runtime/web/public.json'])
profile.update(api_origin='https://demo-api.edubest.dz',web_url='https://demo.edubest.dz')
entries['runtime/web/public.json']=(json.dumps(profile,ensure_ascii=False,indent=2)+'\n').encode()
base=f'/home/ggcsckht/{prefix}'
private='/home/ggcsckht/edubest-review-private/api.env'
entries['applications/edubest-review-api/app.js']=(f'"use strict";\nprocess.env.EDUBEST_ENV_FILE="{private}";\nrequire("{base}/runtime/api/ops/octenium/api-entry.cjs");\n').encode()
entries['applications/edubest-review-api/package.json']=(json.dumps({'name':'edubest-review-api-runner','private':True,'version':'1.0.0','scripts':{
    'initialize-review':f'node ../../runtime/api/scripts/prepare-review.mjs {private}',
    'inspect-review':f'node ../../runtime/api/scripts/review-diagnostics.mjs {private}'}})+'\n').encode()
entries['applications/edubest-review-web/app.js']=(f'"use strict";\nrequire("{base}/runtime/web/entry.cjs");\n').encode()
# A one-shot task: creates fictional data only in a NEW, empty review database.
entries['initialize.cjs']=(f'''"use strict";
const fs=require("node:fs"),path=require("node:path"),{{spawnSync}}=require("node:child_process");
const root=path.join(__dirname,"runtime/api");
const env=require(path.join(root,"node_modules/dotenv")).parse(fs.readFileSync("{private}"));
require(path.join(root,"shared/review-policy.cjs")).validateReview(env);
const result=spawnSync(process.execPath,[path.join(root,"scripts/prepare-review.mjs"),"{private}"],{{cwd:root,env:{{...process.env,...env}},encoding:"utf8"}});
const log=result.status===0?"Review initialized successfully.\\n":"Review initialization failed. Inspect the dedicated configuration and database grants.\\n";
fs.writeFileSync("/home/ggcsckht/edubest-review-private/initialize-status.txt",log,{{mode:0o600}});
process.exitCode=result.status||0;
''').encode()
manifest={'environment':'isolated-review','real_data_included':False,'credentials_included':False,'deployed':False,
          'database':'ggcsckht_edubest_review','outbound_email_push':'disabled',
          'sha256':{n:hashlib.sha256(b).hexdigest() for n,b in entries.items()}}
entries['MANIFEST.json']=(json.dumps(manifest,indent=2)+'\n').encode()
for name in entries:
    if any(part in ('.local','.env','api.env','credentials.private.json') for part in Path(name).parts):
        raise RuntimeError('Private file refused')
with ZipFile(target,'x',ZIP_DEFLATED,compresslevel=6) as z:
    for n,b in entries.items():z.writestr(prefix+'/'+n,b)
with ZipFile(target) as z:assert z.testzip() is None
target.with_suffix('.zip.sha256.txt').write_text(hashlib.sha256(target.read_bytes()).hexdigest()+'  '+target.name+'\n')
print(target)
