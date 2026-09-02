[CmdletBinding()]
param(
  # Use Docker instead of local Node (prefer start-prism-docker.cmd).
  [switch]$Docker,
  # Docker: hot-reload compose.dev.yml instead of compose.local.yml.
  [switch]$Dev,
  # Docker: attach to compose logs (default is detached).
  [switch]$Foreground,
  # Local: npm run start after full build (default local is npm run dev).
  [switch]$Prod,
  # Local: force npm install, skip prisma generate, skip build, keep ports.
  [switch]$Install,
  [switch]$NoPortCleanup,
  [switch]$SkipPrismaGenerate,
  [switch]$SkipBuild,
  [int]$TimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found on PATH."
  }
}

function Ensure-DockerEnvFile {
  $envFile = Join-Path $root ".env.docker"
  $example = Join-Path $root ".env.docker.example"
  $apiEnv = Join-Path $root "apps\api\.env"
  $requiredKeys = @(
    "SUPABASE_DB_URL",
    "DATABASE_URL",
    "PRISMA_DATABASE_URL",
    "DIRECT_URL",
    "DB_SSL",
    "ALLOW_POOLER_FOR_PRISMA",
    "PARE_MODE"
  )

  function Read-DotEnvMap {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $map }
    foreach ($line in Get-Content -LiteralPath $Path) {
      if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $map[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
      }
    }
    return $map
  }

  function Write-DotEnvFile {
    param([string]$Path, [hashtable]$Map, [string[]]$Keys)
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("# Synced for Docker compose. Do not commit.")
    $lines.Add("")
    foreach ($key in $Keys) {
      if ($Map.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$Map[$key])) {
        $lines.Add("$key=$($Map[$key])")
      }
    }
    [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
  }

  $existing = Read-DotEnvMap -Path $envFile
  $needsSync = $false
  foreach ($key in @("DATABASE_URL", "SUPABASE_DB_URL", "PRISMA_DATABASE_URL", "DIRECT_URL")) {
    if (-not $existing.ContainsKey($key) -or [string]::IsNullOrWhiteSpace([string]$existing[$key])) {
      $needsSync = $true
      break
    }
  }

  if (-not (Test-Path -LiteralPath $envFile) -or $needsSync) {
    $apiMap = Read-DotEnvMap -Path $apiEnv
    $merged = @{}
    foreach ($key in $requiredKeys) {
      if ($existing.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$existing[$key])) {
        $merged[$key] = $existing[$key]
      } elseif ($apiMap.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$apiMap[$key])) {
        $merged[$key] = $apiMap[$key]
      }
    }

    if (-not $merged.ContainsKey("DATABASE_URL") -and -not $merged.ContainsKey("SUPABASE_DB_URL")) {
      if (Test-Path -LiteralPath $example) {
        Copy-Item -LiteralPath $example -Destination $envFile -Force
        Write-Host "Created .env.docker from .env.docker.example"
        Write-Host "Fill database URLs in .env.docker (or apps/api/.env) then re-run."
        return
      }
      throw "Missing database URLs. Set them in apps/api/.env or .env.docker."
    }

    Write-DotEnvFile -Path $envFile -Map $merged -Keys $requiredKeys
    Write-Host "Updated .env.docker from apps/api/.env (UTF-8, no BOM)."
  }
}

function Wait-HttpReady {
  param(
    [hashtable[]]$Targets,
    [int]$TimeoutSeconds
  )

  $ready = @{}
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline -and $ready.Count -lt $Targets.Count) {
    foreach ($target in $Targets) {
      if ($ready.ContainsKey($target.Name)) {
        continue
      }
      try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $target.Url -TimeoutSec 3
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
          $ready[$target.Name] = $true
          Write-Host "Ready: $($target.Name) $($target.Url)"
        }
      } catch {
      }
    }
    if ($ready.Count -lt $Targets.Count) {
      Start-Sleep -Seconds 3
    }
  }

  $failed = @($Targets | Where-Object { -not $ready.ContainsKey($_.Name) })
  if ($failed.Count -gt 0) {
    $names = ($failed | ForEach-Object { $_.Name }) -join ", "
    Write-Warning "Still waiting or timed out: $names"
    Write-Warning "Stack may still be starting. Check: docker compose -f $($script:composeFile) ps"
    Write-Warning "Logs: docker compose -f $($script:composeFile) logs -f"
  }
}

function Show-Urls {
  Write-Host ""
  Write-Host "P.R.I.S.M is running."
  Write-Host "  Client:   http://localhost:3001/"
  Write-Host "  Supplier: http://localhost:3002/"
  Write-Host "  Guest:    http://localhost:3003/"
  Write-Host "  Event:    http://localhost:3004/"
  Write-Host "  API:      http://localhost:4000/health"
  Write-Host ""
  Write-Host "Stop local:  .\stop-prism.cmd"
  Write-Host "Stop Docker: .\stop-prism-docker.cmd"
}

# ---------------------------------------------------------------------------
# Default: Docker one-command run
# ---------------------------------------------------------------------------
function Test-DockerEngineReady {
  # docker often prints warnings on stderr; never treat that as a PowerShell error
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $null = & docker info 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Wait-DockerEngine {
  param([int]$TimeoutSeconds = 180)

  if (Test-DockerEngineReady) {
    return
  }

  $dockerDesktop = @(
    (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Docker\Docker\Docker Desktop.exe"),
    (Join-Path $env:LOCALAPPDATA "Docker\Docker Desktop.exe")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

  if ($dockerDesktop) {
    Write-Host "Docker engine is not running. Starting Docker Desktop..."
    Start-Process -FilePath $dockerDesktop | Out-Null
  } else {
    Write-Warning "Docker engine is not running and Docker Desktop.exe was not found."
  }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    if (Test-DockerEngineReady) {
      Write-Host "Docker engine is ready."
      return
    }
    Write-Host "Waiting for Docker engine..."
  }

  throw "Docker engine did not become ready within $TimeoutSeconds seconds. Start Docker Desktop and retry."
}

if ($Docker) {
  Assert-Command -Name "docker"
  Wait-DockerEngine
  Ensure-DockerEnvFile

  $script:composeFile = if ($Dev) { "compose.dev.yml" } else { "compose.local.yml" }
  $modeLabel = if ($Dev) { "dev (hot reload)" } else { "built images" }

  Write-Host "Starting P.R.I.S.M with Docker ($modeLabel) using $composeFile"

  # Parallel multi-service monorepo builds can crash Docker Desktop on Windows.
  $env:COMPOSE_PARALLEL_LIMIT = "1"
  $env:DOCKER_BUILDKIT = "1"

  function Invoke-DockerComposeUp {
    param([switch]$Build)
    $composeArgs = @("compose", "-f", $composeFile, "up")
    if ($Build) { $composeArgs += "--build" }
    if (-not $Foreground) { $composeArgs += "-d" }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      & docker @composeArgs
      return $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $prev
    }
  }

  $exitCode = Invoke-DockerComposeUp -Build
  if ($exitCode -ne 0) {
    Write-Warning "docker compose up --build failed (exit $exitCode). Retrying once..."
    Start-Sleep -Seconds 5
    if (-not (Test-DockerEngineReady)) {
      Wait-DockerEngine
    }
    $exitCode = Invoke-DockerComposeUp -Build
  }
  if ($exitCode -ne 0) {
    throw "docker compose up failed with exit code $exitCode."
  }

  if ($Foreground) {
    exit 0
  }

  $targets = @(
    @{ Name = "api"; Url = "http://localhost:4000/health" },
    @{ Name = "client"; Url = "http://localhost:3001/" },
    @{ Name = "supplier"; Url = "http://localhost:3002/" },
    @{ Name = "guest"; Url = "http://localhost:3003/" },
    @{ Name = "event"; Url = "http://localhost:3004/" }
  )
  Wait-HttpReady -Targets $targets -TimeoutSeconds $TimeoutSeconds
  Show-Urls
  Write-Host "Logs: docker compose -f $composeFile logs -f"
  exit 0
}

# ---------------------------------------------------------------------------
# Local Node mode (default): fast npm run dev, or -Prod for build + start
# ---------------------------------------------------------------------------
Write-Host "Starting P.R.I.S.M locally (Node) - not Docker."

$processEnvironment = [Environment]::GetEnvironmentVariables("Process")
$processEnvironmentNames = @($processEnvironment.Keys)
if (($processEnvironmentNames -contains "Path") -and ($processEnvironmentNames -contains "PATH")) {
  $pathParts = @()
  $seenPathParts = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($candidatePath in @($processEnvironment["Path"], $processEnvironment["PATH"])) {
    foreach ($pathPart in ([string]$candidatePath -split ";")) {
      if ([string]::IsNullOrWhiteSpace($pathPart)) { continue }
      if ($seenPathParts.Add($pathPart)) { $pathParts += $pathPart }
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

$logRoot = Join-Path $root ".local-dev\logs"
$pidFile = Join-Path $logRoot "pids.csv"

$npmScript = if ($Prod) { "start" } else { "dev" }
$apps = @(
  [pscustomobject]@{ Name = "api"; Directory = "apps\api"; Port = 4000; Url = "http://localhost:4000/health"; Args = @("run", $npmScript) },
  [pscustomobject]@{ Name = "client"; Directory = "apps\client"; Port = 3001; Url = "http://localhost:3001/"; Args = @("run", $npmScript) },
  [pscustomobject]@{ Name = "supplier"; Directory = "apps\supplier"; Port = 3002; Url = "http://localhost:3002/"; Args = @("run", $npmScript) },
  [pscustomobject]@{ Name = "guest"; Directory = "apps\guest"; Port = 3003; Url = "http://localhost:3003/"; Args = @("run", $npmScript) },
  [pscustomobject]@{ Name = "event"; Directory = "apps\event"; Port = 3004; Url = "http://localhost:3004/"; Args = @("run", $npmScript) }
)

function Invoke-External {
  param([string]$Label, [string]$WorkingDirectory, [string]$FilePath, [string[]]$ArgumentList)
  Write-Host $Label
  Push-Location $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
}

function Stop-PidTree {
  param([int]$ProcessId)
  if ($ProcessId -le 0) { return }
  try { & taskkill.exe /PID $ProcessId /F /T 2>$null | Out-Null } catch {}
  try { Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue } catch {}
}

function Stop-RecordedProcesses {
  if (-not (Test-Path -LiteralPath $pidFile)) { return }
  Import-Csv -LiteralPath $pidFile | ForEach-Object {
    $recordedPid = 0
    if ([int]::TryParse($_.pid, [ref]$recordedPid)) { Stop-PidTree -ProcessId $recordedPid }
  }
}

function Get-ListeningPortPids {
  param([int]$Port)
  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)"
  netstat -ano | Select-String -Pattern $pattern | ForEach-Object {
    if ($_.Line -match $pattern) { [int]$Matches[1] }
  }
}

function Stop-PortListeners {
  param([int[]]$Ports)
  $targetPids = foreach ($port in $Ports) { Get-ListeningPortPids -Port $port }
  $targetPids = $targetPids | Sort-Object -Unique
  foreach ($targetPid in $targetPids) {
    Write-Host "Clearing port process PID $targetPid"
    Stop-PidTree -ProcessId $targetPid
  }
}

function Ensure-WorkspaceInstall {
  $depsPath = Join-Path $root "node_modules"
  $packageLock = Join-Path $root "package-lock.json"
  if ((Test-Path -LiteralPath $depsPath) -and -not $Install) { return }
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
  if (Test-Path -LiteralPath $outLog) { Get-Content -LiteralPath $outLog -Tail 40 }
  if (Test-Path -LiteralPath $errLog) { Get-Content -LiteralPath $errLog -Tail 40 }
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
  Invoke-External -Label "Generating Prisma client" -WorkingDirectory $root -FilePath "npm.cmd" -ArgumentList @("run", "db:generate")
}

if (-not $SkipBuild) {
  Invoke-External -Label "Building @prism/types" -WorkingDirectory $root -FilePath "npm.cmd" -ArgumentList @("--workspace", "@prism/types", "run", "build")
}

# Default local path is hot-reload dev (no monorepo build). -Prod builds then starts.
$shouldBuild = $Prod -and -not $SkipBuild
if ($shouldBuild) {
  Invoke-External -Label "Building monorepo (dist / .next)" -WorkingDirectory $root -FilePath "npm.cmd" -ArgumentList @("run", "build")
} elseif ($Prod -and $SkipBuild) {
  Write-Host "Skipping monorepo build (-SkipBuild with -Prod)."
} else {
  Write-Host "Local dev mode: npm run dev (skip full build). Use -Prod for production start."
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
    if ($readyApps.ContainsKey($app.Name)) { continue }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $app.Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        $readyApps[$app.Name] = $true
        Write-Host "Ready: $($app.Name) $($app.Url)"
      }
    } catch {}
  }
  if ($readyApps.Count -lt $apps.Count) { Start-Sleep -Seconds 2 }
}

$failedApps = @($apps | Where-Object { -not $readyApps.ContainsKey($_.Name) })
foreach ($app in $failedApps) {
  Write-Warning "Timed out waiting for $($app.Name) at $($app.Url)."
  Show-LogTail -App $app
}
if ($failedApps.Count -gt 0) {
  throw "One or more P.R.I.S.M apps did not become ready. Logs are in $logRoot."
}

Show-Urls
Write-Host "Logs: $logRoot"
Write-Host "Mode: local Node (npm run $npmScript)"
Write-Host "Docker stack (slow): .\start-prism-docker.cmd"
