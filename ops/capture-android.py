"""Official Android CLI scoped to the dedicated capture SDK and virtual phone."""
from pathlib import Path
import subprocess,os,sys,json
root=Path(__file__).resolve().parents[1]
location=json.loads((root/'.local/capture-sdk-location.json').read_text())
sdk=Path(location['sdk']);base=sdk.parent
env=os.environ.copy()
env.update(JAVA_HOME='C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot',ANDROID_HOME=str(sdk),ANDROID_SDK_ROOT=str(sdk),ANDROID_AVD_HOME=str(base/'avd'),ANDROID_USER_HOME=str(base/'android-user'),TEMP=str(base/'tmp'),TMP=str(base/'tmp'))
command=[str(sdk/'cmdline-tools/latest/bin/android.exe'),'--no-metrics','--sdk='+str(sdk),*sys.argv[1:]]
result=subprocess.run(command,cwd=root,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace',creationflags=subprocess.CREATE_NO_WINDOW)
print(result.stdout,end='')
print(result.stderr,end='',file=sys.stderr)
raise SystemExit(result.returncode)
