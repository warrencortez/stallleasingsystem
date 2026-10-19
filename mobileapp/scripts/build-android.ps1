param([switch]$ValidateOnly)

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
# Resolve the Desktop junction before EAS compares this directory with Git's
# canonical repository root. Cross-drive relative paths become absolute paths.
$projectRoot = & node -p "require('fs').realpathSync(process.argv[1])" -- $projectRoot
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the physical project directory.' }
Set-Location -LiteralPath $projectRoot
$repositoryRoot = & git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw 'Cannot locate the Git repository.' }
$relativeProjectPath = & node -p "require('path').relative(process.argv[1], process.argv[2])" -- $repositoryRoot $projectRoot
if ($LASTEXITCODE -ne 0 -or [IO.Path]::IsPathRooted($relativeProjectPath) -or $relativeProjectPath -match '^\.\.([\\/]|$)') {
    throw "Invalid EAS project path: $relativeProjectPath"
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json'))) {
    throw 'The resolved app directory does not contain package.json.'
}
Write-Host "EAS app directory: $projectRoot"
Write-Host "EAS path inside repository: $relativeProjectPath"
if ($ValidateOnly) { exit 0 }
npx.cmd eas-cli@latest build --platform android --profile development
exit $LASTEXITCODE
