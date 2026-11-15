param([switch]$Resume,[string]$ApiUrl='https://api.edubest.dz/api',[string]$WebUrl='https://edubest.dz')
$ErrorActionPreference='Stop'
$eduRoot=Split-Path -Parent $PSScriptRoot
$eduSdk=Join-Path $env:LOCALAPPDATA 'Android/Sdk'
if(!(Test-Path -LiteralPath $eduSdk)){throw 'Android SDK absent.'}
$env:EDUBEST_INTERNAL_BUILD='true'
$env:EDUBEST_RELEASE='true'
$env:NODE_ENV='production'
$env:EXPO_PUBLIC_API_URL=$ApiUrl
$env:EXPO_PUBLIC_WEB_URL=$WebUrl
# This test application deliberately has no remote push account or production credentials.
$env:EXPO_PUBLIC_EAS_PROJECT_ID=''
$env:GOOGLE_SERVICES_JSON=''
$env:ANDROID_HOME=$eduSdk
$env:EXPO_NO_TELEMETRY='1'
Push-Location (Join-Path $eduRoot 'mobile')
try {
  rtk proxy node ../node_modules/expo/bin/cli config --type public --json | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Configuration HTTPS de test refusee.'}
  if(!$Resume){
    rtk proxy node ../node_modules/expo/bin/cli prebuild --platform android --no-install
    if($LASTEXITCODE -ne 0){throw 'Generation Android impossible.'}
  }
} finally {Pop-Location}
$eduAndroid=Join-Path $eduRoot 'mobile/android'
Set-Content -LiteralPath (Join-Path $eduAndroid 'local.properties') -Value ('sdk.dir='+$eduSdk.Replace('\','/')) -Encoding ASCII
$eduFile=Join-Path $eduAndroid 'app/build.gradle'
$eduText=Get-Content -LiteralPath $eduFile -Raw
if($eduText -notmatch "applicationId\s+['`"]dz\.edubest\.preview['`"]"){throw 'Projet natif inattendu : regenerer la version de test sans -Resume.'}
# Generated Android projects may have a prior production signing block. Never use it for this preview.
$eduText=[regex]::Replace($eduText,'(?s)// EDUBEST_RELEASE_SIGNING.*$','')
if($eduText -notmatch 'EDUBEST_PREVIEW_NATIVE'){
 $eduText+=@'

// EDUBEST_PREVIEW_NATIVE
android {
  defaultConfig {
    externalNativeBuild {
      cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" }
    }
  }
  externalNativeBuild {
    cmake { buildStagingDirectory System.getenv("EDUBEST_NATIVE_STAGING") }
  }
}
'@
}
[IO.File]::WriteAllText($eduFile,$eduText.TrimStart([char]0xFEFF),(New-Object Text.UTF8Encoding($false)))
$eduDrive=@('Z','Y','X','W') | Where-Object {!(Get-PSDrive -Name $_ -ErrorAction SilentlyContinue)} | Select-Object -First 1
if(!$eduDrive){throw 'Aucun chemin court disponible.'}
rtk proxy subst "${eduDrive}:" $eduRoot
if($LASTEXITCODE -ne 0){throw 'Chemin court non cree.'}
try {
 $env:EDUBEST_NATIVE_STAGING="${eduDrive}:/.local/android-preview-native"
 Push-Location $eduAndroid
 try {rtk proxy .\gradlew.bat assembleRelease '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a' --no-daemon --console=plain; if($LASTEXITCODE -ne 0){throw 'Compilation APK de test impossible.'}} finally {Pop-Location}
} finally {rtk proxy subst "${eduDrive}:" /D}
$eduArtifact=Join-Path $eduAndroid 'app/build/outputs/apk/release/app-release.apk'
$eduTools=Get-ChildItem -LiteralPath (Join-Path $eduSdk 'build-tools') -Directory | Sort-Object Name -Descending | Select-Object -First 1
rtk proxy (Join-Path $eduTools.FullName 'apksigner.bat') verify --print-certs $eduArtifact
if($LASTEXITCODE -ne 0){throw 'Signature APK non valide.'}
$eduOutput=Join-Path $eduRoot 'release'
New-Item -ItemType Directory -Path $eduOutput -Force | Out-Null
$eduTarget=Join-Path $eduOutput 'EduBest-Essai-1.1.0-20261027.apk'
Copy-Item -LiteralPath $eduArtifact -Destination $eduTarget -Force
$eduStream=[IO.File]::OpenRead($eduTarget)
$eduHasher=[Security.Cryptography.SHA256]::Create()
try {$eduHash=[BitConverter]::ToString($eduHasher.ComputeHash($eduStream)).Replace('-','').ToLowerInvariant()} finally {$eduStream.Dispose();$eduHasher.Dispose()}
Set-Content -LiteralPath ($eduTarget+'.sha256') -Value $eduHash -Encoding ASCII
Write-Output "APK de test uniquement (signature de developpement, paquet dz.edubest.preview) : $eduTarget"
