[CmdletBinding()]
param([string]$Compiler = 'gcc')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$verification = & (Join-Path $projectRoot 'scripts/setup/steam-audio.ps1') | ConvertFrom-Json
$sdkRoot = Join-Path $verification.extraction 'steamaudio'
$headerPath = Join-Path $sdkRoot 'include'
$dllPath = Join-Path $sdkRoot 'lib/windows-x64/phonon.dll'
if (-not (Test-Path -LiteralPath $dllPath)) { throw 'Extract the verified SDK first: ./scripts/setup/steam-audio.ps1 -Download -Extract' }
if (-not [Environment]::Is64BitProcess) { throw 'This spike requires a 64-bit PowerShell process and Windows x64.' }
$compilerInfo = Get-Command $Compiler -ErrorAction Stop
$buildPath = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Path $buildPath -Force | Out-Null
$binaryPath = Join-Path $buildPath 'smoke.exe'
$sourcePath = Join-Path $PSScriptRoot 'smoke.c'
$compileOutput = & $compilerInfo.Source '-std=gnu17' '-Wall' '-Wextra' '-Werror' '-O2' '-I' $headerPath $sourcePath '-o' $binaryPath 2>&1
$compileExit = $LASTEXITCODE
$compileOutput | Set-Content -LiteralPath (Join-Path $buildPath 'compile.log') -Encoding utf8
if ($compileExit -ne 0) { $compileOutput | Write-Output; throw "Compiler failed with exit $compileExit" }
$testOutput = & $binaryPath $dllPath 2>&1
$testExit = $LASTEXITCODE
$testOutput | Set-Content -LiteralPath (Join-Path $buildPath 'smoke-output.jsonl') -Encoding utf8
$testOutput | Write-Output
if ($testExit -ne 0) { throw "SDK smoke test failed with exit $testExit; see build/smoke-output.jsonl" }
$cycles = @($testOutput | ForEach-Object { $_ | ConvertFrom-Json })
if ($cycles.Count -ne 3 -or @($cycles | Where-Object status -ne 'PASS').Count) { throw 'Expected 3 passing lifecycle cycles' }
$compilerVersion = (& $compilerInfo.Source '--version' | Select-Object -First 1)
$metadata = [ordered]@{
    executed_at_utc = [DateTime]::UtcNow.ToString('o')
    status = 'PASS'
    sdk_version = $verification.version
    sdk_sha256 = $verification.sha256
    sdk_dll_sha256 = (Get-FileHash -LiteralPath $dllPath -Algorithm SHA256).Hash.ToLowerInvariant()
    source_sha256 = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    output_sha256 = (Get-FileHash -LiteralPath (Join-Path $buildPath 'smoke-output.jsonl') -Algorithm SHA256).Hash.ToLowerInvariant()
    compiler_path = $compilerInfo.Source
    compiler_version = $compilerVersion
    os = [Environment]::OSVersion.VersionString
    process_architecture = [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
    command = './experiments/sdk-smoke-tests/run.ps1'
    scope = 'Native C API isolated smoke; no audio device playback, no product integration, no memory-leak proof'
    cycles = $cycles
}
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $buildPath 'last-run.json') -Encoding utf8
