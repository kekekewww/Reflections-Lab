param(
    [string]$PythonPath = 'python',
    [string]$ValidatorPath = (Join-Path $env:USERPROFILE '.codex/skills/.system/skill-creator/scripts/quick_validate.py'),
    [switch]$InstallDependency,
    [switch]$IncludeThirdParty
)
$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$dependencyPath = Join-Path $workspaceRoot '.cache/skill-validation'
if (-not (Test-Path -LiteralPath $ValidatorPath -PathType Leaf)) {
    throw 'Official skill-creator quick_validate.py not found; pass -ValidatorPath explicitly.'
}
if ($InstallDependency) {
    & $PythonPath -m pip install --disable-pip-version-check --no-deps --only-binary=:all: --target $dependencyPath 'PyYAML==6.0.3'
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PyYAML install failed.' }
}
$previousPythonPath = $env:PYTHONPATH
try {
    $env:PYTHONPATH = if ($previousPythonPath) { "$dependencyPath$([IO.Path]::PathSeparator)$previousPythonPath" } else { $dependencyPath }
    & $PythonPath -c 'import yaml; assert yaml.__version__ == "6.0.3", "Expected pinned PyYAML 6.0.3"'
    if ($LASTEXITCODE -ne 0) { throw 'PyYAML unavailable. Use a Python with pip and -InstallDependency; no global install required.' }
    $skillDirectories = @(Get-ChildItem -LiteralPath (Join-Path $workspaceRoot '.agents/skills') -Directory)
    $vendorNames = @()
    $vendorManifest = Join-Path $workspaceRoot 'third_party/emil-skills.manifest.json'
    if (Test-Path -LiteralPath $vendorManifest) {
        $vendorData = Get-Content -LiteralPath $vendorManifest -Raw | ConvertFrom-Json
        $vendorNames = @($vendorData.files | Where-Object { $_.localPath -match '^\.agents/skills/([^/]+)/SKILL\.md$' } | ForEach-Object { ($_.localPath -split '/')[2] })
    }
    $projectCount = 0
    $vendorCount = 0
    foreach ($skillDirectory in $skillDirectories) {
        if (-not $IncludeThirdParty -and $vendorNames -contains $skillDirectory.Name) {
            $vendorCount++
            continue
        }
        & $PythonPath -X utf8 $ValidatorPath $skillDirectory.FullName
        if ($LASTEXITCODE -ne 0) { throw "Skill validation failed: $($skillDirectory.Name)" }
        $projectCount++
    }
    Write-Output "PASS: $projectCount project skills (official quick_validate.py)."
    if ($vendorCount -gt 0) {
        $bundleOutput = & node (Join-Path $workspaceRoot 'scripts/setup/emil-skills.mjs') --check 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) { throw "Pinned upstream skill verification failed: $bundleOutput" }
        Write-Output "PASS: $vendorCount upstream skills verified separately by pinned bytes/hash. Upstream frontmatter is preserved; this does not claim official quick_validate compatibility for every vendor field."
    }
} finally {
    $env:PYTHONPATH = $previousPythonPath
}
