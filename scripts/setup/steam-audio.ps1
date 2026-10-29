[CmdletBinding()]
param([switch]$Download, [switch]$Extract)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'third_party/steam-audio/manifest.json') -Raw | ConvertFrom-Json
$cachePath = Join-Path $projectRoot 'third_party/steam-audio/cache'
$archivePath = Join-Path $cachePath $manifest.archive_filename
$extractPath = Join-Path $cachePath $manifest.version
New-Item -ItemType Directory -Path $cachePath -Force | Out-Null
if (-not (Test-Path -LiteralPath $archivePath)) {
    if (-not $Download) { throw "SDK archive absent. Re-run with -Download -Extract to fetch the pinned official release." }
    Invoke-WebRequest -Uri $manifest.download_url -OutFile $archivePath -Headers @{ 'User-Agent' = 'Reflection-Lab-Research' }
}
$archive = Get-Item -LiteralPath $archivePath
if ($archive.Length -ne $manifest.archive_bytes) { throw "SDK size mismatch: $($archive.Length); expected $($manifest.archive_bytes)." }
$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $manifest.sha256) { throw "SDK SHA256 mismatch: $actualHash. Do not load the archive." }
if ($Extract -and -not (Test-Path -LiteralPath $extractPath)) {
    # Expand only a verified official archive, into this version's dedicated cache.
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath
}
$artifactsVerified = 0
if (Test-Path -LiteralPath $extractPath) {
    foreach ($artifact in $manifest.extracted_artifacts) {
        $artifactPath = Join-Path $extractPath $artifact.path
        if (-not (Test-Path -LiteralPath $artifactPath)) { throw "Expected SDK artifact missing: $($artifact.path)" }
        $artifactHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($artifactHash -ne $artifact.sha256) { throw "Extracted SDK artifact differs from pinned official archive: $($artifact.path)" }
        $artifactsVerified++
    }
}
[ordered]@{
    version = $manifest.version
    archive = $archivePath
    sha256 = $actualHash
    bytes = $archive.Length
    extraction = $extractPath
    extracted = (Test-Path -LiteralPath $extractPath)
    artifacts_verified = $artifactsVerified
} | ConvertTo-Json
