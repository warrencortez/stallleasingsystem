$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$buildTools = 'D:\stall-leasing-dev'
if (-not (Test-Path -LiteralPath $buildTools)) {
    throw 'This machine-specific launcher requires D:\stall-leasing-dev.'
}
$env:TEMP = Join-Path $buildTools 'temp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $buildTools 'npm-cache'
# EAS fingerprinting misresolves this machine's C:-to-D: node_modules junction.
# EAS still uploads the source and compiles the native app on its build worker.
$env:EAS_SKIP_AUTO_FINGERPRINT = '1'
New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null
$portableNode = Join-Path $buildTools 'node22\node_modules\node\bin\node.exe'
if (Test-Path -LiteralPath $portableNode) {
    $env:PATH = (Split-Path $portableNode -Parent) + ';' + $env:PATH
}
Set-Location -LiteralPath $projectRoot
npx.cmd eas-cli@latest build --platform android --profile development
exit $LASTEXITCODE
