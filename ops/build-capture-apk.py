"""Build an x86_64 release variant for the screenshot emulator, preserving Play deliverables."""
from pathlib import Path
import subprocess,os,json,shutil,zipfile,hashlib
root=Path(__file__).resolve().parents[1]
base=Path('D:/EduBest-Captures-20261029')
private=root/'.local/android-signing/credentials.private.json'
key=json.loads(private.read_text(encoding='utf-8-sig'))
keystore=Path(key['keystore'])
if not keystore.is_absolute():keystore=private.parent/keystore
env=os.environ.copy()
env.update(EXPO_PUBLIC_API_URL='https://api.edubest.dz/api',EXPO_PUBLIC_WEB_URL='https://edubest.dz',
    EXPO_PUBLIC_REVIEW_API_URL='https://demo-api.edubest.dz/api',EXPO_PUBLIC_REVIEW_WEB_URL='https://demo.edubest.dz',
    EDUBEST_ANDROID_VERSION_CODE='3',EDUBEST_ANDROID_VERSION_NAME='1.1.2',EDUBEST_RELEASE='true',
    EDUBEST_INTERNAL_BUILD='false',EDUBEST_LOCAL_RELEASE='true',EAS_BUILD_PROFILE='production',NODE_ENV='production',
    JAVA_HOME='C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot',ANDROID_HOME=str(Path.home()/'AppData/Local/Android/Sdk'),
    EDUBEST_ANDROID_KEYSTORE_FILE=str(keystore),EDUBEST_ANDROID_KEY_ALIAS=key['alias'],
    EDUBEST_ANDROID_STORE_PASSWORD=key['store_password'],EDUBEST_ANDROID_KEY_PASSWORD=key['key_password'],
    TEMP=str(base/'tmp'),TMP=str(base/'tmp'),EDUBEST_NATIVE_STAGING=str(base/'native-cache-x86'))
drive=next((letter for letter in ['Z','Y','X','W'] if not Path(letter+':/').exists()),None)
if not drive:raise RuntimeError('No available short build drive')
subprocess.run(['rtk','proxy','subst',drive+':',str(root)],check=True,capture_output=True)
try:
    log=root/'.local/capture/x86-release-build.log'
    with log.open('w',encoding='utf-8') as output:
        result=subprocess.run(['rtk','proxy','./gradlew.bat','assembleRelease','-PreactNativeArchitectures=x86_64','--no-daemon','--console=plain'],cwd=root/'mobile/android',env=env,stdout=output,stderr=subprocess.STDOUT)
    if result.returncode:raise RuntimeError('Capture build failed. See the private build log.')
finally:subprocess.run(['rtk','proxy','subst',drive+':','/D'],capture_output=True)
source=root/'mobile/android/app/build/outputs/apk/release/app-release.apk'
target=root/'.local/capture/EduBest-code3-x86_64-capture.apk'
shutil.copyfile(source,target)
with zipfile.ZipFile(target) as new,zipfile.ZipFile(root/'release/EduBest-3.apk') as released:
    assert any(n.startswith('lib/x86_64/') for n in new.namelist())
    new_js=new.read('assets/index.android.bundle');old_js=released.read('assets/index.android.bundle')
    same_js=hashlib.sha256(new_js).digest()==hashlib.sha256(old_js).digest()
    assert same_js,'Expected the exact release JavaScript bundle for genuine store captures'
(root/'verification/android-capture-build-20261029.json').write_text(json.dumps({'artifact':str(target),'abi':'x86_64','version':'1.1.2','version_code':3,'same_javascript_as_release_apk':same_js,'play_artifacts_preserved':True},indent=2)+'\n')
print('Native screenshot APK ready:',target)
