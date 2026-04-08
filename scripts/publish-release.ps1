param(
    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [Parameter(Mandatory = $true)]
    [string]$ApkPath,

    [string]$ReleaseTitle = "",

    [string]$Notes = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is required. Install from https://cli.github.com/"
}

if (-not (Test-Path -Path $ApkPath -PathType Leaf)) {
    throw "APK file not found: $ApkPath"
}

$resolvedApk = (Resolve-Path $ApkPath).Path
$shaPath = "$resolvedApk.sha256"

Write-Host "Computing SHA256..."
$hash = Get-FileHash -Path $resolvedApk -Algorithm SHA256
"sha256:$($hash.Hash.ToLower())" | Set-Content -Path $shaPath -NoNewline -Encoding ASCII

$releaseTitle = $ReleaseTitle
if ([string]::IsNullOrWhiteSpace($releaseTitle)) {
    $releaseTitle = $Tag
}

$existingRelease = $false
try {
    gh release view $Tag | Out-Null
    $existingRelease = $true
} catch {
    $existingRelease = $false
}

if (-not $existingRelease) {
    Write-Host "Creating tag and release $Tag..."
    git tag $Tag
    git push origin $Tag

    if ([string]::IsNullOrWhiteSpace($Notes)) {
        gh release create $Tag --title $releaseTitle --generate-notes
    } else {
        gh release create $Tag --title $releaseTitle --notes $Notes
    }
} else {
    Write-Host "Release $Tag already exists."
}

Write-Host "Uploading APK + checksum..."
gh release upload $Tag "$resolvedApk" "$shaPath" --clobber

Write-Host "Done."
