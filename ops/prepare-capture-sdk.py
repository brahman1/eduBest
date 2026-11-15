"""Install official Android CLI tools in the ignored workspace SDK, preserving the user's SDK."""
from pathlib import Path
from urllib.request import urlopen
import zipfile,hashlib,shutil,subprocess,os,sys
root=Path(__file__).resolve().parents[1]
sdk=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'.local/android-phone-sdk'
sdk.mkdir(parents=True,exist_ok=True)
tools=sdk/'cmdline-tools/latest'
if not (tools/'bin/sdkmanager.bat').exists():
    archive=sdk/'commandlinetools-win-15859902_latest.zip'
    if not archive.exists():
        print('Downloading official Android CLI tools...',flush=True)
        with urlopen('https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip',timeout=45) as response, archive.open('wb') as output:
            shutil.copyfileobj(response,output)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!='90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a':
        raise RuntimeError('Official CLI checksum mismatch')
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            if not name.startswith('cmdline-tools/') or name.endswith('/'):continue
            rel=Path(name).relative_to('cmdline-tools')
            if '..' in rel.parts:raise RuntimeError('Unsafe archive path')
            target=tools/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
source_license=Path.home()/'AppData/Local/Android/Sdk/licenses/android-sdk-license'
(sdk/'licenses').mkdir(exist_ok=True)
# Reuse the SAME SDK license already accepted on this workstation. Never auto-accept new terms.
if source_license.exists():shutil.copyfile(source_license,sdk/'licenses/android-sdk-license')
env=os.environ.copy();env['JAVA_HOME']='C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot'
env['ANDROID_SDK_ROOT']=str(sdk);env['ANDROID_HOME']=str(sdk)
temporary=sdk.parent/'tmp';temporary.mkdir(exist_ok=True)
env['TEMP']=str(temporary);env['TMP']=str(temporary)
env['JAVA_TOOL_OPTIONS']='-Djava.io.tmpdir='+str(temporary)
# The failed C: install recorded an absolute temporary path. Drop only that new,
# incomplete operation marker; never remove an installed image or an existing SDK.
for marker in (sdk/'system-images').glob('android-36/google_apis/x86_64/.installer/.installData'):
    if 'outputs' in marker.read_text(errors='replace') and 'PackageOperation' in marker.read_text(errors='replace'):
        assert marker.resolve().is_relative_to(sdk.resolve())
        marker.unlink()
print('Installing official Android phone system image...',flush=True)
result=subprocess.run([str(tools/'bin/sdkmanager.bat'),'--sdk_root='+str(sdk),'system-images;android-36;google_apis;x86_64'],cwd=root,env=env,input='',text=True)
raise SystemExit(result.returncode)
