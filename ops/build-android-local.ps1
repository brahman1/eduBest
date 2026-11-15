$ErrorActionPreference='Stop'
$edubestRoot=Split-Path -Parent $PSScriptRoot
$edubestAndroid=Join-Path $edubestRoot 'mobile/android'
$edubestSdk=Join-Path $env:LOCALAPPDATA 'Android/Sdk'
if(!(Test-Path -LiteralPath $edubestSdk)){throw 'Android SDK absent. Installer les outils officiels Android Studio.'}
if(!(Test-Path -LiteralPath (Join-Path $edubestAndroid 'gradlew.bat'))){throw 'ExÃ©cuter expo prebuild --platform android --no-install avant cette commande.'}
$env:ANDROID_HOME=$edubestSdk
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:4200/api'
$env:EXPO_PUBLIC_WEB_URL='http://127.0.0.1:3100'
$env:NODE_ENV='production'
$edubestSdkProperty=$edubestSdk.Replace('\','/')
Set-Content -LiteralPath (Join-Path $edubestAndroid 'local.properties') -Value "sdk.dir=$edubestSdkProperty" -Encoding ASCII
$edubestGradle=Join-Path $edubestAndroid 'app/build.gradle'
if(!(Select-String -LiteralPath $edubestGradle -Pattern 'EDUBEST_WINDOWS_PATH_FIX' -Quiet)){
  Add-Content -LiteralPath $edubestGradle -Value '// EDUBEST_WINDOWS_PATH_FIX' -Encoding ASCII
  Add-Content -LiteralPath $edubestGradle -Value 'android { defaultConfig { externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } } } }' -Encoding ASCII
}
if(!(Select-String -LiteralPath $edubestGradle -Pattern 'EDUBEST_NATIVE_STAGING' -Quiet)){
  Add-Content -LiteralPath $edubestGradle -Value 'android { externalNativeBuild { cmake { buildStagingDirectory System.getenv("EDUBEST_NATIVE_STAGING") } } }' -Encoding ASCII
}
$edubestDrive=@('Z','Y','X','W') | Where-Object {!(Get-PSDrive -Name $_ -ErrorAction SilentlyContinue)} | Select-Object -First 1
if(!$edubestDrive){throw 'Aucune lettre disponible pour raccourcir le chemin de compilation Windows.'}
rtk proxy subst "${edubestDrive}:" $edubestRoot
if($LASTEXITCODE -ne 0){throw 'Impossible de crÃ©er le chemin court de compilation.'}
try{
  $env:EDUBEST_NATIVE_STAGING="${edubestDrive}:/native-cache"
  Push-Location $edubestAndroid
  try{
    rtk proxy .\gradlew.bat assembleRelease --no-daemon --console=plain
    if($LASTEXITCODE -ne 0){throw 'La compilation Android a Ã©chouÃ©.'}
  }finally{Pop-Location}
}finally{rtk proxy subst "${edubestDrive}:" /D}
$edubestApk=Join-Path $edubestAndroid 'app/build/outputs/apk/release/app-release.apk'
Copy-Item -LiteralPath $edubestApk -Destination (Join-Path $edubestRoot 'EduBest-Android-test-local.apk')
Write-Output 'APK local crÃ©Ã©. Signature de dÃ©veloppement ; connexion USB avec adb reverse requise. Ne pas publier sur le Play Store.'

