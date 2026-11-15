$ErrorActionPreference = 'Stop'
$eduRoot = Split-Path -Parent $PSScriptRoot
$eduBin = 'C:\Program Files\PostgreSQL\17\bin'
$eduLocal = Join-Path $eduRoot '.local'
$eduData = Join-Path $eduLocal 'postgres'
New-Item -ItemType Directory -Path $eduLocal -Force | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $eduBin 'initdb.exe'))) { throw 'PostgreSQL 17 absent. Utiliser Docker ou installer PostgreSQL.' }
if (!(Test-Path -LiteralPath (Join-Path $eduData 'PG_VERSION'))) {
  $eduPasswordFile = Join-Path $eduLocal 'pg-init-password.tmp'
  Set-Content -LiteralPath $eduPasswordFile -Value 'edubest_local_only' -Encoding ASCII
  try {
    & (Join-Path $eduBin 'initdb.exe') -D $eduData -U edubest --auth-host=scram-sha-256 --auth-local=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$eduPasswordFile
    if ($LASTEXITCODE -ne 0) { throw 'Initialisation PostgreSQL locale impossible.' }
  } finally { Remove-Item -LiteralPath $eduPasswordFile -Force }
}
& (Join-Path $eduBin 'pg_ctl.exe') -D $eduData status
if ($LASTEXITCODE -ne 0) {
  $eduArguments = @('-D',('"'+$eduData+'"'),'-l',('"'+(Join-Path $eduLocal 'postgres.log')+'"'),'-o','"-p 5448 -h 127.0.0.1"','-w','start')
  $eduProcess = Start-Process -FilePath (Join-Path $eduBin 'pg_ctl.exe') -ArgumentList $eduArguments -WindowStyle Hidden -PassThru
  # Wait for pg_ctl only: Start-Process -Wait also waits for its PostgreSQL descendants.
  $eduProcess.WaitForExit()
  if ($eduProcess.ExitCode -ne 0) { throw 'Démarrage PostgreSQL EduBest impossible.' }
}
$env:PGPASSWORD = 'edubest_local_only'
foreach ($eduDatabase in @('edubest','edubest_test')) {
  $eduExists = & (Join-Path $eduBin 'psql.exe') -h 127.0.0.1 -p 5448 -U edubest -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$eduDatabase'"
  if ($LASTEXITCODE -ne 0) { throw 'Connexion PostgreSQL EduBest impossible.' }
  if ($eduExists -ne '1') {
    & (Join-Path $eduBin 'createdb.exe') -h 127.0.0.1 -p 5448 -U edubest $eduDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Création de la base EduBest impossible.' }
  }
}
Remove-Item Env:PGPASSWORD
$eduMailpit = Join-Path $eduLocal 'mailpit/mailpit.exe'
if (Test-Path -LiteralPath $eduMailpit) {
  $eduRunning = Get-CimInstance Win32_Process -Filter "Name='mailpit.exe'" | Where-Object { $_.ExecutablePath -eq $eduMailpit }
  if (!$eduRunning) {
    Start-Process -FilePath $eduMailpit -ArgumentList @('--listen','127.0.0.1:8038','--smtp','127.0.0.1:1038','--database',(Join-Path $eduLocal 'mailpit.db')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $eduLocal 'mailpit.log') -RedirectStandardError (Join-Path $eduLocal 'mailpit-error.log')
  }
} else { Write-Warning 'Mailpit absent : les invitations restent en file d’envoi. Voir README.md.' }
Write-Output 'PostgreSQL EduBest : 5448 ; boîte mail de test : http://127.0.0.1:8038 si Mailpit est présent.'
