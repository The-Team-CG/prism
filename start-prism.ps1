[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$NoPortCleanup,
  [switch]$SkipPrismaGenerate,
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

$processEnvironment = [Environment]::GetEnvironmentVariables("Process")
$processEnvironmentNames = @($processEnvironment.Keys)
if (($processEnvironmentNames -contains "Path") -and ($processEnvironmentNames -contains "PATH")) {
  $pathParts = @()
  $seenPathParts = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($candidatePath in @($processEnvironment["Path"], $processEnvironment["PATH"])) {
    foreach ($pathPart in ([string]$candidatePath -split ";")) {
      if ([string]::IsNullOrWhiteSpace($pathPart)) {
        continue
      }

      if ($seenPathParts.Add($pathPart)) {
        $pathParts += $pathPart
      }
    }
  }

  $normalizedPath = $pathParts -join ";"
  [Environment]::SetEnvironmentVariable("PATH", $null, "Process")
  [Environment]::SetEnvironmentVariable("Path", $normalizedPath, "Process")
}

$nodeDirectory = Join-Path $env:ProgramFiles "nodejs"
if (Test-Path -LiteralPath (Join-Path $nodeDirectory "node.exe")) {
  $currentPath = [Environment]::GetEnvironmentVariable("Path", "Process")
  $currentPathParts = @([string]$currentPath -split ";")
  if (-not ($currentPathParts -contains $nodeDirectory)) {
    [Environment]::SetEnvironmentVariable("Path", "$nodeDirectory;$currentPath", "Process")
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logRoot = Join-Path $root ".local-dev\logs"
$pidFile = Join-Path $logRoot "pids.csv"

$apps = @(
  [pscustomobject]@{
    Name = "api"
    Directory = "apps\api"
    Port = 4000
    Url = "http://localhost:4000/health"
    Args = @("run", "dev")
  },
  [pscustomobject]@{
    Name = "client"
    Directory = "apps\client"
    Port = 3001
    Url = "http://localhost:3001/"
    Args = @("run", "dev")
  },
  [pscustomobject]@{
    Name = "supplier"
    Directory = "apps\supplier"
    Port = 3002
    Url = "http://localhost:3002/"
    Args = @("run", "dev")
  },
  [pscustomobject]@{
    Name = "guest"
    Directory = "apps\guest"
    Port = 3003
    Url = "http://localhost:3003/"
    Args = @("run", "dev")
  },
  [pscustomobject]@{
    Name = "event"
    Directory = "apps\event"
    Port = 3004
    Url = "http://localhost:3004/"
    Args = @("run", "dev")
  }
)

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found on PATH."
  }
}

function Invoke-External {
  param(
    [string]$Label,
    [string]$WorkingDirectory,
    [string]$FilePath,
    [string[]]$ArgumentList
  )

  Write-Host $Label
  Push-Location $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "$Label failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

function Stop-PidTree {
  param([int]$ProcessId)

  if ($ProcessId -le 0) {
    return
  }

  try {
    & taskkill.exe /PID $ProcessId /F /T 2>$null | Out-Null
  } catch {
  }

  try {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  } catch {
  }
}

function Stop-RecordedProcesses {
  if (-not (Test-Path -LiteralPath $pidFile)) {
    return
  }

  Import-Csv -LiteralPath $pidFile | ForEach-Object {
    $recordedPid = 0
    if ([int]::TryParse($_.pid, [ref]$recordedPid)) {
      Stop-PidTree -ProcessId $recordedPid
    }
  }
}

function Get-ListeningPortPids {
  param([int]$Port)

  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)"
  netstat -ano |
    Select-String -Pattern $pattern |
    ForEach-Object {
      if ($_.Line -match $pattern) {
        [int]$Matches[1]
      }
    }
}

function Stop-PortListeners {
  param([int[]]$Ports)

  $targetPids = foreach ($port in $Ports) {
    Get-ListeningPortPids -Port $port
  }

  $targetPids = $targetPids | Sort-Object -Unique
  foreach ($targetPid in $targetPids) {
    Write-Host "Clearing port process PID $targetPid"
    Stop-PidTree -ProcessId $targetPid
  }
}

function Ensure-WorkspaceInstall {
  $nodeModules = Join-Path $root "node_modules"
  $packageLock = Join-Path $root "package-lock.json"

  if ((Test-Path -LiteralPath $nodeModules) -and -not $Install) {
    return
  }

  if ($Install) {
    Invoke-External -Label "Installing workspace packages" -WorkingDirectory $root -FilePath "npm.cmd" -ArgumentList @("install")
    return
  }

  if (Test-Path -LiteralPath $packageLock) {
    Invoke-External -Label "Installing workspace packages with npm ci" -WorkingDirectory $root -FilePath "npm.cmd" -ArgumentList @("ci")
  } else {
    Invoke-External -Label "Installing workspace packages" -WorkingDirectory $root -FilePath "npm.cmd" -ArgumentList @("install")
  }
}

function Show-LogTail {
  param([pscustomobject]$App)

  $outLog = Join-Path $logRoot "$($App.Name).out.log"
  $errLog = Join-Path $logRoot "$($App.Name).err.log"

  Write-Host ""
  Write-Host "Last output for $($App.Name):"
  if (Test-Path -LiteralPath $outLog) {
    Get-Content -LiteralPath $outLog -Tail 40
  }

  if (Test-Path -LiteralPath $errLog) {
    Get-Content -LiteralPath $errLog -Tail 40
  }
}

Assert-Command -Name "node.exe"
Assert-Command -Name "npm.cmd"

New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

foreach ($app in $apps) {
  $directory = Join-Path $root $app.Directory
  if (-not (Test-Path -LiteralPath (Join-Path $directory "package.json"))) {
    throw "Missing package.json in $($app.Directory)."
  }
}

if (-not $NoPortCleanup) {
  Stop-RecordedProcesses
  Stop-PortListeners -Ports @(3000, 3001, 3002, 3003, 3004, 4000)
  Start-Sleep -Seconds 1
}

Ensure-WorkspaceInstall

if (-not $SkipPrismaGenerate) {
  Invoke-External -Label "Generating Prisma client in apps\api" -WorkingDirectory $root -FilePath "npm.cmd" -ArgumentList @("run", "db:generate")
}

Write-Host "Seeding PARE demo data in apps\api"
Push-Location (Join-Path $root "apps\api")
try {
  & node.exe --env-file=.env prisma/seed-pare.mjs
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "PARE seed exited with code $LASTEXITCODE - continuing startup."
  }
} catch {
  Write-Warning "PARE seed failed - continuing startup."
} finally {
  Pop-Location
}

"name,pid,port,directory" | Set-Content -LiteralPath $pidFile

foreach ($app in $apps) {
  $directory = Join-Path $root $app.Directory
  $outLog = Join-Path $logRoot "$($app.Name).out.log"
  $errLog = Join-Path $logRoot "$($app.Name).err.log"

  Remove-Item -LiteralPath $outLog, $errLog -Force -ErrorAction SilentlyContinue

  $process = Start-Process -FilePath "npm.cmd" `
    -ArgumentList $app.Args `
    -WorkingDirectory $directory `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru

  "$($app.Name),$($process.Id),$($app.Port),$($app.Directory)" | Add-Content -LiteralPath $pidFile
  Write-Host "Started $($app.Name) on port $($app.Port) with launcher PID $($process.Id)"
}

$readyApps = @{}
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

while ((Get-Date) -lt $deadline -and $readyApps.Count -lt $apps.Count) {
  foreach ($app in $apps) {
    if ($readyApps.ContainsKey($app.Name)) {
      continue
    }

    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $app.Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        $readyApps[$app.Name] = $true
        Write-Host "Ready: $($app.Name) $($app.Url)"
      }
    } catch {
    }
  }

  if ($readyApps.Count -lt $apps.Count) {
    Start-Sleep -Seconds 2
  }
}

$failedApps = @($apps | Where-Object { -not $readyApps.ContainsKey($_.Name) })
foreach ($app in $failedApps) {
  Write-Warning "Timed out waiting for $($app.Name) at $($app.Url)."
  Show-LogTail -App $app
}

if ($failedApps.Count -gt 0) {
  throw "One or more P.R.I.S.M apps did not become ready. Logs are in $logRoot."
}

Write-Host ""
Write-Host "P.R.I.S.M is running."
Write-Host "  Client:   http://localhost:3001/"
Write-Host "  Supplier: http://localhost:3002/"
Write-Host "  Guest:    http://localhost:3003/"
Write-Host "  Event:    http://localhost:3004/"
Write-Host "  API:      http://localhost:4000/health"
Write-Host ""
Write-Host "Logs: $logRoot"
Write-Host "Stop all apps with: .\stop-prism.cmd"
