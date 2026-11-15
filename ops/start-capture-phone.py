from pathlib import Path
import os,subprocess,json
root=Path(__file__).resolve().parents[1]
sdk=Path(json.loads((root/'.local/capture-sdk-location.json').read_text())['sdk']);base=sdk.parent
env=os.environ.copy();env.update(ANDROID_HOME=str(sdk),ANDROID_SDK_ROOT=str(sdk),ANDROID_AVD_HOME=str(base/'avd'),ANDROID_USER_HOME=str(base/'android-user'),TEMP=str(base/'tmp'),TMP=str(base/'tmp'))
log=base/'emulator-capture.log'
with log.open('w',encoding='utf-8') as output:
    process=subprocess.Popen([str(sdk/'emulator/emulator.exe'),'-avd','EduBest_Play_Phone_20261029','-port','5580','-no-window','-no-audio','-no-boot-anim','-no-snapshot','-gpu','swiftshader_indirect','-memory','2048','-cores','2'],env=env,stdout=output,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
(root/'.local/capture-emulator-process.json').write_text(json.dumps({'pid':process.pid,'serial':'emulator-5580','avd':'EduBest_Play_Phone_20261029','log':str(log)},indent=2))
print('Capture-only emulator launched; PID:',process.pid)
