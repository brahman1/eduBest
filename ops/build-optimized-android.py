"""Build signed, optimized code 4 with the existing private upload key."""
from pathlib import Path
import json, os, subprocess, shutil

root = Path(__file__).resolve().parents[1]
base = Path('D:/EduBest-Captures-20261029')
private = root / '.local/android-signing/credentials.private.json'
key = json.loads(private.read_text(encoding='utf-8-sig'))
keystore = Path(key['keystore'])
if not keystore.is_absolute():
    keystore = private.parent / keystore
env = os.environ.copy()
env.update(
    EXPO_PUBLIC_API_URL='https://api.edubest.dz/api', EXPO_PUBLIC_WEB_URL='https://edubest.dz',
    EXPO_PUBLIC_REVIEW_API_URL='https://demo-api.edubest.dz/api', EXPO_PUBLIC_REVIEW_WEB_URL='https://demo.edubest.dz',
    EDUBEST_ANDROID_VERSION_CODE='4', EDUBEST_ANDROID_ARCHITECTURES='arm64-v8a,armeabi-v7a,x86_64',
    JAVA_HOME='C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot',
    TEMP=str(base/'tmp'), TMP=str(base/'tmp'), EDUBEST_NATIVE_STAGING=str(base/'native-cache-code4'),
    EDUBEST_ANDROID_KEYSTORE_FILE=str(keystore), EDUBEST_ANDROID_KEY_ALIAS=key['alias'],
    EDUBEST_ANDROID_STORE_PASSWORD=key['store_password'], EDUBEST_ANDROID_KEY_PASSWORD=key['key_password'],
)
print('Free space C/D (MB):', *[shutil.disk_usage(x).free//1024//1024 for x in ['C:/','D:/']], flush=True)
for fmt in ['aab', 'apk']:
    target = root / f'release/EduBest-4.{fmt}'
    if target.exists():
        print('Preserving existing artifact:', target.name, flush=True)
        continue
    log = root / f'.local/android-code4-{fmt}-optimized.log'
    with log.open('w', encoding='utf-8') as output:
        result = subprocess.run(['rtk','proxy','powershell','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'ops/build-android-release.ps1'),'-Resume','-Format',fmt], cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT)
    print(fmt, 'exit:', result.returncode, 'log:', log, flush=True)
    if result.returncode:
        raise SystemExit(result.returncode)
