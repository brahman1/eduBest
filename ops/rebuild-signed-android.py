"""Reuse this workstation's private upload key without writing secrets to logs."""
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
credentials_path = root / '.local/android-signing/credentials.private.json'
credentials = json.loads(credentials_path.read_text(encoding='utf-8-sig'))
keystore = Path(credentials['keystore'])
if not keystore.is_absolute():
    keystore = credentials_path.parent / keystore
environment = os.environ.copy()
version_code = sys.argv[2] if len(sys.argv) > 2 else '2'
if not version_code.isdigit() or int(version_code) < 2:
    raise ValueError('Invalid Android version code')
if '--review' in sys.argv[3:]:
    environment.update({
        'EXPO_PUBLIC_REVIEW_API_URL': 'https://demo-api.edubest.dz/api',
        'EXPO_PUBLIC_REVIEW_WEB_URL': 'https://demo.edubest.dz',
    })
environment.update({
    'EXPO_PUBLIC_API_URL': 'https://api.edubest.dz/api',
    'EXPO_PUBLIC_WEB_URL': 'https://edubest.dz',
    'EDUBEST_ANDROID_VERSION_CODE': version_code,
    'EDUBEST_ANDROID_KEYSTORE_FILE': str(keystore),
    'EDUBEST_ANDROID_KEY_ALIAS': credentials['alias'],
    'EDUBEST_ANDROID_STORE_PASSWORD': credentials['store_password'],
    'EDUBEST_ANDROID_KEY_PASSWORD': credentials['key_password'],
})
log = root / '.local/android-production-r3-20261027.log'
artifact_format = sys.argv[1] if len(sys.argv) > 1 else 'aab'
if artifact_format not in ('aab', 'apk'):
    raise ValueError('Use aab or apk')
if artifact_format == 'apk':
    log = root / '.local/android-production-r3-apk-20261028.log'
if version_code != '2':
    log = root / f'.local/android-code{version_code}-{artifact_format}-20261029.log'
with log.open('w', encoding='utf-8') as output:
    result = subprocess.run(['rtk', 'proxy', 'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(root / 'ops/build-android-release.ps1'), '-Resume', '-Format', artifact_format], cwd=root, env=environment, stdout=output, stderr=subprocess.STDOUT)
print('Android build exit:', result.returncode, '; log:', log)
sys.exit(result.returncode)
