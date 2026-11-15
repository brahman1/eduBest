$ErrorActionPreference='Stop'
$eduRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $eduRoot
$env:DATABASE_URL='postgresql://edubest:edubest_local_only@127.0.0.1:5448/edubest_test'
$env:EDUBEST_TEST_DATABASE='true'
$env:EDUBEST_DEMO_ENABLED='false'
$env:TEST_API_URL='http://127.0.0.1:4206/api'
$env:TEST_WEB_URL='http://127.0.0.1:3100'
$env:TEST_MAIL_URL='http://127.0.0.1:8038'
$env:PORT='4206'
$env:NODE_ENV='development'
Push-Location api
try { rtk proxy node dist/migrate.js; if($LASTEXITCODE -ne 0){throw 'Migration test impossible.'} } finally{Pop-Location}
$eduApi=Start-Process -FilePath (Get-Command node).Source -ArgumentList (Join-Path $eduRoot 'api/dist/main.js') -WorkingDirectory (Join-Path $eduRoot 'api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $eduRoot '.local/test-api.log') -RedirectStandardError (Join-Path $eduRoot '.local/test-api-error.log') -PassThru
try {
  $eduReady=$false
  foreach($eduAttempt in 1..30){
    try{ $eduResponse=Invoke-WebRequest -Uri 'http://127.0.0.1:4206/api/public/health' -UseBasicParsing; if($eduResponse.StatusCode -eq 200){$eduReady=$true;break} }catch{}
    Start-Sleep -Milliseconds 350
  }
  if(!$eduReady){throw 'API de test indisponible.'}
  rtk proxy npm.cmd test
  $eduExit=$LASTEXITCODE
}finally{if(!$eduApi.HasExited){Stop-Process -Id $eduApi.Id}}
exit $eduExit
