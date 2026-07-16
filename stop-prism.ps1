[CmdletBinding()]
param(
  # Also remove named Docker volumes (node_modules mounts for dev compose).
  [switch]$Volumes,
  # Skip docker compose down; only stop local Node processes.
  [switch]$LocalOnly,
  [int[]]$Ports = @(3000, 3001, 3002, 3003, 3004, 4000)
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$logRoot = Join-Path $root ".local-dev\logs"
$pidFile = Join-Path $logRoot "pids.csv"

function Stop-PidTree {
  param([int]$ProcessId)
  if ($ProcessId -le 0) { return }
  try { & taskkill.exe /PID $ProcessId /F /T 2>$null | Out-Null } catch {}
  try { Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue } catch {}
}

function Get-ListeningPortPids {
  param([int]$Port)
  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)"
  netstat -ano | Select-String -Pattern $pattern | ForEach-Object {
    if ($_.Line -match $pattern) { [int]$Matches[1] }
  }
}

function Stop-DockerStacks {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker not on PATH; skipping compose down."
    return
  }

  foreach ($composeFile in @("compose.local.yml", "compose.dev.yml")) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $composeFile))) {
      continue
    }
    $downArgs = @("compose", "-f", $composeFile, "down", "--remove-orphans")
    if ($Volumes) {
      $downArgs += "-v"
    }
    Write-Host "Stopping Docker stack: $composeFile"
    & docker @downArgs 2>$null
  }
}

function Stop-LocalProcesses {
  $targetPids = @()

  if (Test-Path -LiteralPath $pidFile) {
    Import-Csv -LiteralPath $pidFile | ForEach-Object {
      $recordedPid = 0
      if ([int]::TryParse($_.pid, [ref]$recordedPid)) {
        $targetPids += $recordedPid
      }
    }
  }

  foreach ($port in $Ports) {
    $targetPids += Get-ListeningPortPids -Port $port
  }

  $targetPids = $targetPids | Sort-Object -Unique
  if ($targetPids.Count -eq 0) {
    Write-Host "No local P.R.I.S.M Node processes were found."
    return
  }

  foreach ($targetPid in $targetPids) {
    Write-Host "Stopping local PID $targetPid"
    Stop-PidTree -ProcessId $targetPid
  }

  Start-Sleep -Seconds 1

  $remaining = foreach ($port in $Ports) {
    Get-ListeningPortPids -Port $port
  }
  if ($remaining) {
    $remaining = $remaining | Sort-Object -Unique
    Write-Warning "Some localhost listeners are still running: $($remaining -join ', ')"
  } else {
    Write-Host "Stopped local P.R.I.S.M Node apps."
  }
}

if (-not $LocalOnly) {
  Stop-DockerStacks
}

Stop-LocalProcesses

Write-Host "P.R.I.S.M stop complete."
