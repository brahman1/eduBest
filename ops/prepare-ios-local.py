"""Validate/export iOS JavaScript and generate native sources; never signs an IPA."""
from pathlib import Path
import os, subprocess, json, sys

root = Path(__file__).resolve().parents[1]
env = os.environ.copy()
env.update(EDUBEST_IOS_PREPARE='true', EDUBEST_RELEASE='true', EAS_BUILD_PLATFORM='ios', EAS_BUILD_PROFILE='ios-production', NODE_ENV='production',
    EXPO_PUBLIC_API_URL='https://api.edubest.dz/api', EXPO_PUBLIC_WEB_URL='https://edubest.dz', EXPO_PUBLIC_REVIEW_API_URL='', EXPO_PUBLIC_REVIEW_WEB_URL='')
out = root/'verification/ios-20261113'
out.mkdir(exist_ok=True)
cli = root/'node_modules/expo/bin/cli'
config = subprocess.run(['rtk','proxy','node',str(cli),'config','--type','public','--json'],cwd=root/'mobile',env=env,capture_output=True,text=True,encoding='utf-8')
if config.returncode:
    print(config.stderr[-2000:]); raise SystemExit(config.returncode)
public = json.loads(config.stdout)
assert public['ios']['bundleIdentifier'] == 'dz.edubest.app'
assert public['ios']['supportsTablet'] is True
assert public['ios']['infoPlist']['ITSAppUsesNonExemptEncryption'] is False
assert 'NSAppTransportSecurity' not in public['ios']['infoPlist']
assert public['extra']['deployment'] == 'production'
(out/'expo-config-public.json').write_text(json.dumps(public,ensure_ascii=False,indent=2),encoding='utf-8')
jobs = [(['export','--platform','ios','--output-dir','../.local/ios-export-production'],'javascript-export.log')]
if sys.platform != 'win32':
    jobs.insert(0, (['prebuild','--platform','ios','--no-install'],'native-prebuild.log'))
else:
    (out/'native-prebuild-status.json').write_text(json.dumps({'status':'pending_mac','reason':'Expo does not generate native iOS sources on Windows.'},indent=2))
for args,name in jobs:
    with (out/name).open('w',encoding='utf-8') as log:
        result = subprocess.run(['rtk','proxy','node',str(cli),*args],cwd=root/'mobile',env=env,stdout=log,stderr=subprocess.STDOUT)
    print(name, 'exit', result.returncode, flush=True)
    if result.returncode: raise SystemExit(result.returncode)
