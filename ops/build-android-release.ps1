param([ValidateSet('aab','apk')][string]$Format='aab',[switch]$Resume)
$ErrorActionPreference='Stop'
$eduRoot=Split-Path -Parent $PSScriptRoot
foreach($eduRequired in @('EXPO_PUBLIC_API_URL','EXPO_PUBLIC_WEB_URL','EDUBEST_ANDROID_KEYSTORE_FILE','EDUBEST_ANDROID_KEY_ALIAS','EDUBEST_ANDROID_STORE_PASSWORD','EDUBEST_ANDROID_KEY_PASSWORD','EDUBEST_ANDROID_VERSION_CODE')) {
  if([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($eduRequired))){throw "Champ de publication absent : $eduRequired"}
}
if(!(Test-Path -LiteralPath $env:EDUBEST_ANDROID_KEYSTORE_FILE -PathType Leaf)){throw 'Clé de signature Android introuvable.'}
$env:EDUBEST_ANDROID_KEYSTORE_FILE=(Resolve-Path -LiteralPath $env:EDUBEST_ANDROID_KEYSTORE_FILE).Path
$eduVersion=0
if(![int]::TryParse($env:EDUBEST_ANDROID_VERSION_CODE,[ref]$eduVersion) -or $eduVersion -lt 1){throw 'Code de version Android invalide.'}
$eduSdk=Join-Path $env:LOCALAPPDATA 'Android/Sdk'
if(!(Test-Path -LiteralPath $eduSdk)){throw 'Android SDK absent.'}
$env:EDUBEST_RELEASE='true'
$env:EDUBEST_INTERNAL_BUILD='false'
$env:EDUBEST_LOCAL_RELEASE='true'
$env:EAS_BUILD_PROFILE='production'
$env:NODE_ENV='production'
$env:EDUBEST_ANDROID_VERSION_NAME=(Get-Content -LiteralPath (Join-Path $eduRoot 'mobile/package.json') -Raw | ConvertFrom-Json).version
$env:ANDROID_HOME=$eduSdk
Push-Location (Join-Path $eduRoot 'mobile')
try {
  # The config rejects local, missing or placeholder URLs before native files change.
  rtk proxy node ../node_modules/expo/bin/cli config --type public --json | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Configuration de publication refusée.'}
  if(!$Resume){
    rtk proxy node ../node_modules/expo/bin/cli prebuild --platform android --no-install
    if($LASTEXITCODE -ne 0){throw 'Génération Android impossible.'}
  }
} finally {Pop-Location}
$eduAndroid=Join-Path $eduRoot 'mobile/android'
Set-Content -LiteralPath (Join-Path $eduAndroid 'local.properties') -Value ('sdk.dir='+$eduSdk.Replace('\','/')) -Encoding ASCII
$eduGradle=Join-Path $eduAndroid 'app/build.gradle'
$eduSigning=@'
// EDUBEST_RELEASE_SIGNING — credentials are read from environment, never embedded.
android {
  signingConfigs {
    edubestProduction {
      storeFile file(System.getenv("EDUBEST_ANDROID_KEYSTORE_FILE"))
      storePassword System.getenv("EDUBEST_ANDROID_STORE_PASSWORD")
      keyAlias System.getenv("EDUBEST_ANDROID_KEY_ALIAS")
      keyPassword System.getenv("EDUBEST_ANDROID_KEY_PASSWORD")
    }
  }
  buildTypes { release { signingConfig signingConfigs.edubestProduction } }
  defaultConfig {
    versionCode Integer.parseInt(System.getenv("EDUBEST_ANDROID_VERSION_CODE"))
    versionName System.getenv("EDUBEST_ANDROID_VERSION_NAME")
    externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } }
  }
  externalNativeBuild { cmake { buildStagingDirectory System.getenv("EDUBEST_NATIVE_STAGING") } }
}
'@
$eduGradleText=Get-Content -LiteralPath $eduGradle -Raw
$eduGradleText=$eduGradleText.Replace('getDefaultProguardFile("proguard-android.txt")','getDefaultProguardFile("proguard-android-optimize.txt")')
if($eduGradleText -notmatch "applicationId\s+['`"]dz\.edubest\.app['`"]"){throw 'Identifiant natif de production inattendu.'}
if($eduGradleText -notmatch 'EDUBEST_RELEASE_SIGNING'){$eduGradleText+="`n"+$eduSigning}
if($eduGradleText -notmatch 'versionName System.getenv\("EDUBEST_ANDROID_VERSION_NAME"\)'){
  $eduGradleText=$eduGradleText.Replace('versionCode Integer.parseInt(System.getenv("EDUBEST_ANDROID_VERSION_CODE"))', 'versionCode Integer.parseInt(System.getenv("EDUBEST_ANDROID_VERSION_CODE"))'+"`n"+'    versionName System.getenv("EDUBEST_ANDROID_VERSION_NAME")')
}
[IO.File]::WriteAllText($eduGradle,$eduGradleText.TrimStart([char]0xFEFF),(New-Object Text.UTF8Encoding($false)))
$eduDrive=@('Z','Y','X','W') | Where-Object {!(Get-PSDrive -Name $_ -ErrorAction SilentlyContinue)} | Select-Object -First 1
if(!$eduDrive){throw 'Aucun chemin court disponible pour la compilation.'}
rtk proxy subst "${eduDrive}:" $eduRoot
if($LASTEXITCODE -ne 0){throw 'Création du chemin court impossible.'}
try {
  if(!$env:EDUBEST_NATIVE_STAGING){$env:EDUBEST_NATIVE_STAGING="${eduDrive}:/native-cache"}
  Push-Location $eduAndroid
  try {
    $eduTask=if($Format -eq 'aab'){'bundleRelease'}else{'assembleRelease'}
    $eduArchitectures=if($env:EDUBEST_ANDROID_ARCHITECTURES){$env:EDUBEST_ANDROID_ARCHITECTURES}else{'arm64-v8a,armeabi-v7a'}
    if($eduArchitectures -notmatch '^(arm64-v8a|armeabi-v7a|x86_64)(,(arm64-v8a|armeabi-v7a|x86_64))*$'){throw 'Architectures Android invalides.'}
    rtk proxy .\gradlew.bat $eduTask "-PreactNativeArchitectures=$eduArchitectures" '-Pandroid.enableMinifyInReleaseBuilds=true' '-Pandroid.enableShrinkResourcesInReleaseBuilds=true' --no-daemon --console=plain
    if($LASTEXITCODE -ne 0){throw 'Compilation Android de publication impossible.'}
  } finally {Pop-Location}
} finally {rtk proxy subst "${eduDrive}:" /D}
$eduArtifact=if($Format -eq 'aab'){Join-Path $eduAndroid 'app/build/outputs/bundle/release/app-release.aab'}else{Join-Path $eduAndroid 'app/build/outputs/apk/release/app-release.apk'}
if($Format -eq 'aab') {
  $eduVerified=rtk proxy jarsigner '-J-Duser.language=en' -verify $eduArtifact
  if($LASTEXITCODE -ne 0 -or (($eduVerified -join "`n") -notmatch 'jar verified\.')){throw 'Vérification cryptographique du bundle Android impossible.'}
  $eduCertificate=rtk proxy keytool -printcert -jarfile $eduArtifact
  if($LASTEXITCODE -ne 0 -or ($eduCertificate -match 'Android Debug')){throw 'Signature de publication non valide ou signature de développement détectée.'}
} else {
  $eduSigner=Get-ChildItem -LiteralPath (Join-Path $eduSdk 'build-tools') -Directory | Sort-Object Name -Descending | Select-Object -First 1
  $eduCertificate=rtk proxy (Join-Path $eduSigner.FullName 'apksigner.bat') verify --print-certs $eduArtifact
  if($LASTEXITCODE -ne 0 -or ($eduCertificate -match 'Android Debug')){throw 'Signature de publication non valide ou signature de développement détectée.'}
}
$eduOutput=Join-Path $eduRoot 'release'
New-Item -ItemType Directory -Path $eduOutput -Force | Out-Null
$eduTarget=Join-Path $eduOutput "EduBest-$eduVersion.$Format"
if(Test-Path -LiteralPath $eduTarget){throw 'Livrable existant : augmentez le code de version avant de reconstruire.'}
Copy-Item -LiteralPath $eduArtifact -Destination $eduTarget
$eduStream=[IO.File]::OpenRead($eduTarget)
$eduHasher=[Security.Cryptography.SHA256]::Create()
try {$eduHash=[BitConverter]::ToString($eduHasher.ComputeHash($eduStream)).Replace('-','').ToLowerInvariant()} finally {$eduStream.Dispose();$eduHasher.Dispose()}
Set-Content -LiteralPath ($eduTarget+'.sha256') -Value $eduHash -Encoding ASCII
Write-Output "Livrable signé créé : $eduTarget"
