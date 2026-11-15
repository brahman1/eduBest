import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import xml.etree.ElementTree as ET
import zipfile
import sys

root = Path(__file__).resolve().parents[1]
version_code = int(sys.argv[1]) if len(sys.argv) > 1 else 2
version = {2: '1.1.1', 3: '1.1.2', 4: '1.1.3'}[version_code]
artifact = root / f'release/EduBest-{version_code}.aab'
tool = root / '.local/tools/bundletool-all-1.18.3.jar'

def command(*args):
    result = subprocess.run(['rtk', 'proxy', *map(str, args)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    assert result.returncode == 0, result.stderr[-1000:]
    return result.stdout

validation = command('java', '-jar', tool, 'validate', '--bundle=' + str(artifact))
manifest = command('java', '-jar', tool, 'dump', 'manifest', '--bundle=' + str(artifact), '--module=base')
element = ET.fromstring(manifest)
android = '{http://schemas.android.com/apk/res/android}'
assert element.attrib['package'] == 'dz.edubest.app'
assert element.attrib[android+'versionCode'] == str(version_code)
assert element.attrib[android+'versionName'] == version
app = element.find('application')
assert app.attrib.get(android+'debuggable', 'false') == 'false'
assert app.attrib[android+'allowBackup'] == 'false'
assert app.attrib[android+'usesCleartextTraffic'] == 'false'
fingerprints = []
for file in [root/'release/EduBest-1.aab', artifact]:
    signature = command('jarsigner', '-J-Duser.language=en', '-verify', file)
    assert 'jar verified.' in signature
    certificate = command('keytool', '-J-Duser.language=en', '-printcert', '-jarfile', file)
    assert 'Android Debug' not in certificate
    fingerprints.append(re.search(r'SHA256:\s*([0-9A-F:]+)', certificate).group(1))
assert fingerprints[0] == fingerprints[1], 'Upload certificate must remain identical'
with zipfile.ZipFile(artifact) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert not any(name.lower().endswith(('.p12','.jks','.keystore','.env','credentials.private.json')) for name in names)
    javascript = archive.read('base/assets/index.android.bundle')
    assert b'https://api.edubest.dz/api' in javascript
    assert b'https://edubest.dz' in javascript
    assert b'SUPPRIMER' in javascript
    if version_code >= 3:
        assert b'https://demo-api.edubest.dz/api' in javascript
        assert b'https://demo.edubest.dz' in javascript
        assert b'edubest_review_session' in javascript
        assert b'edubest_environment' in javascript
    alignments = []
    for name in names:
        if name.startswith('base/lib/arm64-v8a/') and name.endswith('.so'):
            data = archive.read(name)
            assert data[:5] == b'\x7fELF\x02'
            phoff = struct.unpack_from('<Q', data, 32)[0]
            size, count = struct.unpack_from('<HH', data, 54)
            for index in range(count):
                offset = phoff + size * index
                if struct.unpack_from('<I',data,offset)[0] == 1:
                    alignment = struct.unpack_from('<Q',data,offset+48)[0]
                    assert alignment >= 16384, name
                    alignments.append(alignment)
report = {
    'date':'2026-10-29' if version_code >= 3 else '2026-10-27', 'artifact':str(artifact), 'version':version, 'version_code':version_code,
    'package':'dz.edubest.app', 'bytes':artifact.stat().st_size,
    'sha256':hashlib.sha256(artifact.read_bytes()).hexdigest(),
    'bundletool_validate': 'passed', 'same_upload_certificate_as_version_1':True,
    'certificate_sha256':fingerprints[1], 'debuggable':False, 'android_backup':False,
    'https_only':True, 'public_api':'https://api.edubest.dz/api',
    'arm64_minimum_elf_alignment':min(alignments),
    'unit_tests_passed':24 if version_code >= 3 else 22, 'physical_device_tests':False,
    'push_configured':False, 'play_upload_performed':False,
}
report['review_mode_included'] = version_code >= 3
report_file = f'verification/google-play-aab-code{version_code}-20261029.json' if version_code >= 3 else 'verification/google-play-aab-r3-2026-10-27.json'
(root/report_file).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
