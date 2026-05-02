[CmdletBinding()]
param(
  [int[]]$Ports = @(3000, 3001, 3002, 3003, 3004, 4000)
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logRoot = Join-Path $root ".local-dev\logs"
$pidFile = Join-Path $logRoot "pids.csv"

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
  Write-Host "No P.R.I.S.M localhost processes were found."
  exit 0
}

foreach ($targetPid in $targetPids) {
  Write-Host "Stopping PID $targetPid"
  Stop-PidTree -ProcessId $targetPid
}

Start-Sleep -Seconds 1

$remaining = foreach ($port in $Ports) {
  Get-ListeningPortPids -Port $port
}

if ($remaining) {
  $remaining = $remaining | Sort-Object -Unique
  throw "Some localhost listeners are still running: $($remaining -join ', ')"
}

Write-Host "Stopped P.R.I.S.M localhost apps."
