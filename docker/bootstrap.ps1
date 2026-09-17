[CmdletBinding()]
param(
    [string]$InstallDirectory,
    [string]$BackupDirectory,
    [string]$RepositoryUrl = 'https://github.com/kisia0916/gcc-api-server.git',
    [string]$Branch = 'main'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($InstallDirectory)) {
    $repositoryCandidate = Split-Path -Parent $PSScriptRoot
    if (Test-Path -LiteralPath (Join-Path $repositoryCandidate '.git')) {
        $InstallDirectory = $repositoryCandidate
    } else {
        $InstallDirectory = Join-Path $PSScriptRoot 'gcc-api-server'
    }
}
$InstallDirectory = [IO.Path]::GetFullPath($InstallDirectory)
if ([string]::IsNullOrWhiteSpace($BackupDirectory)) {
    $BackupDirectory = Join-Path (Split-Path -Parent $InstallDirectory) 'gcc-api-server-backups'
}
$BackupDirectory = [IO.Path]::GetFullPath($BackupDirectory)

function New-UrlSafeSecret {
    $bytes = [byte[]]::new(32)
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Executable,
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed with exit code $LASTEXITCODE"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required but was not found in PATH.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is required but was not found in PATH.'
}

$repositoryDirectory = Join-Path $InstallDirectory '.git'
if (-not (Test-Path -LiteralPath $InstallDirectory)) {
    $parentDirectory = Split-Path -Parent $InstallDirectory
    if ($parentDirectory) {
        New-Item -ItemType Directory -Force -Path $parentDirectory | Out-Null
    }
    Invoke-ExternalCommand -Executable git -Arguments @(
        'clone', '--branch', $Branch, '--single-branch', $RepositoryUrl, $InstallDirectory
    )
} elseif (-not (Test-Path -LiteralPath $repositoryDirectory)) {
    throw "Install directory exists but is not a Git repository: $InstallDirectory"
} else {
    $currentBranch = (& git -C $InstallDirectory branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not determine the current Git branch.'
    }
    if ($currentBranch -ne $Branch) {
        throw "Expected branch '$Branch' but found '$currentBranch'."
    }
    Invoke-ExternalCommand -Executable git -Arguments @(
        '-C', $InstallDirectory, 'pull', '--ff-only', 'origin', $Branch
    )
}

$dockerDirectory = Join-Path $InstallDirectory 'docker'
$composePath = Join-Path $dockerDirectory 'compose.yaml'
if (-not (Test-Path -LiteralPath $composePath)) {
    throw "Docker Compose file was not found: $composePath"
}

New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$backupPathForDocker = (Resolve-Path -LiteralPath $BackupDirectory).Path.Replace('\', '/')
$envPath = Join-Path $dockerDirectory '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    $environmentLines = @(
        'MONGO_ROOT_USERNAME=gcc_admin',
        "MONGO_ROOT_PASSWORD=$(New-UrlSafeSecret)",
        'MONGO_DATABASE=gcc-api',
        'MONGO_VOLUME_NAME=gcc-api-server-mongo-data',
        "MONGO_BACKUP_DIRECTORY=$backupPathForDocker",
        'MONGO_BACKUP_INTERVAL_SECONDS=86400',
        'MONGO_BACKUP_RETENTION_DAYS=30',
        '',
        'AUTH_NAME=launcher',
        "AUTH_PASSWORD=$(New-UrlSafeSecret)",
        '',
        'API_BIND_ADDRESS=0.0.0.0',
        'API_PORT=5555',
        'MONGO_BIND_ADDRESS=127.0.0.1',
        'MONGO_PORT=27017'
    )
    [IO.File]::WriteAllLines($envPath, $environmentLines, [Text.UTF8Encoding]::new($false))
    Write-Host "Created secure credentials in $envPath"
} else {
    $envText = [IO.File]::ReadAllText($envPath)
    $updatedEnvText = [Text.RegularExpressions.Regex]::Replace(
        $envText,
        '(?m)^API_PORT=3000(?=\r?$)',
        'API_PORT=5555'
    )
    if ($updatedEnvText -ne $envText) {
        [IO.File]::WriteAllText($envPath, $updatedEnvText, [Text.UTF8Encoding]::new($false))
        $envText = $updatedEnvText
        Write-Host "Updated API_PORT from 3000 to 5555 in $envPath"
    }
    if ($envText -notmatch '(?m)^MONGO_BACKUP_DIRECTORY=') {
        [IO.File]::AppendAllText(
            $envPath,
            "`r`nMONGO_BACKUP_DIRECTORY=$backupPathForDocker`r`n",
            [Text.UTF8Encoding]::new($false)
        )
    }
}

$volumeLine = Get-Content -LiteralPath $envPath | Where-Object {
    $_ -match '^MONGO_VOLUME_NAME='
} | Select-Object -First 1
$databaseVolume = if ($volumeLine) {
    ($volumeLine -split '=', 2)[1].Trim()
} else {
    'gcc-api-server-mongo-data'
}
if (-not $databaseVolume) {
    throw 'MONGO_VOLUME_NAME must not be empty.'
}
& docker volume inspect $databaseVolume *> $null
if ($LASTEXITCODE -ne 0) {
    Invoke-ExternalCommand -Executable docker -Arguments @('volume', 'create', $databaseVolume)
}

Push-Location $InstallDirectory
try {
    $composeArguments = @('compose', '--env-file', $envPath, '-f', $composePath)
    Invoke-ExternalCommand -Executable docker -Arguments @(
        $composeArguments + @('up', '--build', '-d')
    )
    Invoke-ExternalCommand -Executable docker -Arguments @(
        $composeArguments + @('ps')
    )
} finally {
    Pop-Location
}

Write-Host "API deployment is ready in $InstallDirectory"
Write-Host "MongoDB backups are stored in $BackupDirectory"
