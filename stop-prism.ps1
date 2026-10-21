[CmdletBinding()]
param(
  # Prefer stop-prism-docker.cmd. Stops Compose apps and local Supabase.
  [switch]$Docker,
  # When used with -Docker, also remove named volumes.
  [switch]$Volumes,
  # Stop both Docker stacks and local Node processes.
  [switch]$All
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Stop-DockerStacks {
  & node.exe (Join-Path $root "scripts\compose-watch.mjs") stop
  if ($LASTEXITCODE -ne 0) { throw "Could not stop Compose Watch." }
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker not on PATH; skipping compose down."
    return
  }

  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    foreach ($composeFile in @("compose.local.yml", "compose.dev.yml")) {
      if (-not (Test-Path -LiteralPath (Join-Path $root $composeFile))) {
        continue
      }
      $downArgs = @("compose", "-f", $composeFile, "down", "--remove-orphans")
      if ($Volumes) {
        $downArgs += "-v"
      }
      Write-Host "Stopping Docker stack: $composeFile"
      & docker @downArgs 2>$null | Out-Null
    }
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Stop-LocalDatabase {
  & node.exe (Join-Path $root "scripts\local-supabase.mjs") stop
  if ($LASTEXITCODE -ne 0) { throw "Could not stop local Supabase. Check Docker and service logs." }
}

function Stop-LocalProcesses {
  $portsScript = Join-Path $root "scripts\prism-ports.mjs"
  $json = & node.exe $portsScript --json
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($json -join ""))) {
    throw "Unable to resolve current-checkout P.R.I.S.M ports."
  }
  try {
    $portInfo = ($json -join "`n") | ConvertFrom-Json
  } catch {
    throw "The P.R.I.S.M port resolver returned invalid JSON: $($_.Exception.Message)"
  }

  foreach ($app in @("api", "client", "supplier", "guest", "event")) {
    $port = $portInfo.ports.$app
    Write-Host "Asking the lease-aware guard to stop $app on port $port"
    & node.exe (Join-Path $root "scripts\kill-prism-port.cjs") --app $app --port $port --root $root
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Stopped owned $app processes."
    } elseif ($LASTEXITCODE -eq 1) {
      Write-Warning "The $app port was not cleared because ownership could not be proven; foreign and unleased processes were preserved."
    } else {
      throw "The lease-aware $app port guard failed with exit code $LASTEXITCODE."
    }
  }
}

if ($Docker -and -not $All) {
  Write-Host "Stopping Docker apps and local Supabase."
  Stop-DockerStacks
  Stop-LocalDatabase
  Write-Host "P.R.I.S.M Docker stop complete."
  exit 0
}

if ($All) {
  Write-Host "Stopping Docker stacks and local Node processes."
  Stop-DockerStacks
  Stop-LocalProcesses
  Stop-LocalDatabase
  Write-Host "P.R.I.S.M stop complete (all)."
  exit 0
}

Write-Host "Stopping local Node apps and local Supabase."
Stop-LocalProcesses
Stop-LocalDatabase
Write-Host "P.R.I.S.M local stop complete."
Write-Host "Docker: .\stop-prism-docker.cmd"
