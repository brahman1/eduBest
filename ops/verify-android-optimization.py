"""Verify actual R8 metadata rather than infer optimization from build flags."""
from pathlib import Path
import json, zipfile, hashlib

root = Path(__file__).resolve().parents[1]
def dex_size(archive):
    return sum(info.file_size for info in archive.infolist() if info.filename.endswith('.dex'))

with zipfile.ZipFile(root/'release/EduBest-3.aab') as old, zipfile.ZipFile(root/'release/EduBest-4.aab') as new:
    metadata = json.loads(new.read('BUNDLE-METADATA/com.android.tools/r8.json'))
    for option in ['isObfuscationEnabled','isOptimizationsEnabled','isShrinkingEnabled']:
        assert metadata['options'][option] is True
    rates = {name:round(100-metadata['stats'][key],2) for name,key in [('obfuscation','noObfuscationPercentage'),('optimization','noOptimizationPercentage'),('shrinking','noShrinkingPercentage')]}
    assert min(rates.values()) >= 25, rates
    assert 'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map' in new.namelist()
    report = {'version':'1.1.3','version_code':4,'r8_version':metadata['version'],'r8_percentages':rates,'dex_bytes_before':dex_size(old),'dex_bytes_after':dex_size(new),'mapping_embedded':True,'r8_metadata':metadata,'google_play_reanalysis_pending':True}
    with zipfile.ZipFile(root/'release/EduBest-4.apk') as apk:
        for name in [n for n in new.namelist() if n.startswith('base/dex/') and n.endswith('.dex')]:
            assert hashlib.sha256(new.read(name)).digest()==hashlib.sha256(apk.read(Path(name).name)).digest(), name
        assert new.read('base/assets/index.android.bundle') == apk.read('assets/index.android.bundle')
        report['tested_apk_same_dex_and_javascript_as_aab'] = True
(root/'verification/android-r8-code4-20261029.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='r8_metadata'},indent=2))
