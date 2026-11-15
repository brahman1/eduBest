"""Native Android capture helper, restricted to the disposable emulator-5580."""
from pathlib import Path
import subprocess,os,sys,json,xml.etree.ElementTree as ET,re
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[1]
sdk=Path(json.loads((root/'.local/capture-sdk-location.json').read_text())['sdk']);base=sdk.parent
env=os.environ.copy();env.update(ANDROID_HOME=str(sdk),ANDROID_SDK_ROOT=str(sdk),ANDROID_AVD_HOME=str(base/'avd'),ANDROID_USER_HOME=str(base/'android-user'),TEMP=str(base/'tmp'),TMP=str(base/'tmp'))
local=root/'.local/capture';local.mkdir(exist_ok=True)
def adb(*args,secret=False,binary=False):
    r=subprocess.run([str(sdk/'platform-tools/adb.exe'),'-s','emulator-5580',*map(str,args)],env=env,capture_output=True,timeout=90)
    if r.returncode:raise RuntimeError('Android command failed' if secret else r.stderr.decode(errors='replace')[:1000])
    return r.stdout if binary else r.stdout.decode(errors='replace')
def layout():
    adb('shell','uiautomator','dump','/sdcard/edubest-layout.xml')
    xml=adb('exec-out','cat','/sdcard/edubest-layout.xml');(local/'current-layout.xml').write_text(xml,encoding='utf-8')
    rows=[]
    for node in ET.fromstring(xml).iter('node'):
        a=node.attrib
        if a.get('text') or a.get('content-desc') or a.get('class','').endswith('EditText'):
            rows.append({k:('[hidden]' if a.get('password')=='true' and k=='text' else a.get(k,'')) for k in ['text','content-desc','class','resource-id','bounds','clickable','focused','password']})
    print(json.dumps(rows,ensure_ascii=False,indent=2))
action=sys.argv[1]
if action=='install':print(adb('install','-r',root/'release/EduBest-3.apk'))
elif action=='install-capture':print(adb('install','-r',root/'.local/capture/EduBest-code3-x86_64-capture.apk'))
elif action=='install-optimized':print(adb('install','-r',root/'release/EduBest-4.apk'))
elif action=='status':
    print('Boot:',adb('shell','getprop','sys.boot_completed').strip())
    print('\n'.join(line.strip() for line in adb('shell','dumpsys','package','dz.edubest.app').splitlines() if 'versionCode=' in line or 'versionName=' in line))
elif action=='crashes':
    crash=adb('logcat','-b','crash','-d')
    (local/'code4-crash-buffer.log').write_text(crash,encoding='utf-8')
    print(crash[:6000])
elif action=='start':print(adb('shell','am','start','-n','dz.edubest.app/.MainActivity'))
elif action=='stop':print(adb('emu','kill'))
elif action=='layout':layout()
elif action=='tap':print(adb('shell','input','tap',int(sys.argv[2]),int(sys.argv[3])))
elif action=='swipe':print(adb('shell','input','swipe',*[int(x) for x in sys.argv[2:]]))
elif action=='key':print(adb('shell','input','keyevent',int(sys.argv[2])))
elif action=='email':
    email=sys.argv[2]
    if email not in ['direction@edubest.test','professeur@edubest.test','parent@edubest.test','eleve@edubest.test']:raise ValueError('Demo emails only')
    adb('shell','input','text',email);print('Fictional email entered')
elif action=='password':
    tree=ET.fromstring((local/'current-layout.xml').read_text(encoding='utf-8'))
    if not any(n.attrib.get('password')=='true' and n.attrib.get('focused')=='true' for n in tree.iter('node')):raise RuntimeError('Observe and focus the password field first')
    config={k:json.loads(v) for k,v in (line.split('=',1) for line in (root/'.local/review-octenium/api.env').read_text().splitlines() if line and not line.startswith('#'))}
    password=config['EDUBEST_REVIEW_PASSWORD'];assert re.fullmatch(r'[A-Za-z0-9_-]{24,}',password)
    adb('shell','input','text',password,secret=True);print('Review password entered privately')
elif action=='capture':
    name=sys.argv[2];assert re.fullmatch(r'[a-z0-9-]+',name)
    folder=root/'store/google-play/phone';folder.mkdir(parents=True,exist_ok=True)
    target=folder/(name+'.png');target.write_bytes(adb('exec-out','screencap','-p',binary=True));print(target)
else:raise ValueError('Unknown action')
