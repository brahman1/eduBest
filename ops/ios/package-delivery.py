"""Package source and publication preparation without credentials or fake screenshots."""
from pathlib import Path
import zipfile, json, hashlib, struct

root = Path(__file__).resolve().parents[2]
release = root/'release'
release.mkdir(exist_ok=True)
full = release/'EduBest-iOS-Preparation-20261113.zip'
store = release/'EduBest-App-Store-Informations-20261113.zip'
forbidden_parts = {'node_modules','.git','.local','.next','.expo','native-cache','android','ios','dist','build','backups'}
allowed = {'.ts','.tsx','.mjs','.cjs','.js','.json','.css','.svg','.png','.jpg','.jpeg','.ico','.woff','.woff2','.ttf','.md','.txt','.sql','.html'}
root_files = ['package.json','package-lock.json','.nvmrc','.gitignore','.easignore','AGENTS.md','Demarrer-iOS.command']
files = [root/name for name in root_files]
for directory in ['mobile','shared','api','web','scripts','tests']:
    for file in (root/directory).rglob('*'):
        if not file.is_file(): continue
        rel = file.relative_to(root)
        if any(p in forbidden_parts for p in rel.parts[1:-1]): continue
        if file.name.startswith('.') or file.suffix.lower() not in allowed: continue
        if file.name.lower() in {'credentials.json','google-services.json'} or 'service-account' in file.name.lower(): continue
        files.append(file)
files += list((root/'store/app-store').rglob('*'))
files += [root/'ops/ios/mac.mjs', root/'ops/ios/capture-series.mjs']
files += [
    root/'verification/ios-20261113/validation.json',
    root/'verification/ios-20261113/expo-config-public.json',
]
files = sorted(set(file for file in files if file.is_file()))
manifest = []
with zipfile.ZipFile(full,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        rel = file.relative_to(root).as_posix()
        assert '.env' not in file.name and not file.name.lower().endswith(('.p8','.p12','.pem','.mobileprovision','.jks','.keystore','.ipa','.dump'))
        data = file.read_bytes()
        if file.name == 'Demarrer-iOS.command':
            info = zipfile.ZipInfo(rel)
            info.create_system = 3
            info.external_attr = 0o100755 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info,data.replace(b'\r\n',b'\n'))
        else:
            archive.writestr(rel,data)
        manifest.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
with zipfile.ZipFile(store,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root/'store/app-store').rglob('*')):
        if file.is_file(): archive.write(file,file.relative_to(root/'store/app-store').as_posix())
for file in [full,store]:
    with zipfile.ZipFile(file) as archive:
        assert archive.testzip() is None
    (Path(str(file)+'.sha256')).write_text(hashlib.sha256(file.read_bytes()).hexdigest()+'\n')
report = {'source_archive':str(full),'source_files':len(manifest),'source_manifest':manifest,'store_archive':str(store),'contains_secrets':False,'signed_ipa_generated':False,'native_screenshots_generated':False,'native_build_and_apple_review_access_pending':True}
(root/'verification/ios-20261113/delivery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(full,full.stat().st_size)
print(store,store.stat().st_size)
print(len(manifest),'source files; no IPA or native screenshot claimed')
