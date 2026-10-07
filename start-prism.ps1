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
  # Prepare local Supabase and migrations without launching apps.
  [switch]$DatabaseOnly,
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

function Resolve-PrismPorts {
  $portsScript = Join-Path $root "scripts\prism-ports.mjs"
  $json = & node.exe $portsScript --json
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($json -join ""))) {
    throw "Unable to resolve P.R.I.S.M ports with $portsScript."
  }
  try {
    return ($json -join "`n") | ConvertFrom-Json
  } catch {
    throw "The P.R.I.S.M port resolver returned invalid JSON: $($_.Exception.Message)"
  }
}

Assert-Command -Name "node.exe"
$portInfo = Resolve-PrismPorts
$prismPorts = $portInfo.ports
if ($Docker -and -not $portInfo.isPrimary) {
  throw "Docker mode uses the canonical compose ports and is supported only from the primary checkout. Run start-prism.ps1 without -Docker for linked worktrees."
}

function Prepare-LocalDatabase {
  & node.exe (Join-Path $root "scripts\local-supabase.mjs") start
  if ($LASTEXITCODE -ne 0) { throw "Local Supabase preparation failed. Apps were not started." }
  $env:PRISM_ENV_FILE = Join-Path $root ".local-dev\api.env"
  # Clear inherited hosted values. The generated environment is the only dev input.
  foreach ($key in @("SUPABASE_DB_URL", "PRISMA_DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL", "DATABASE_URL")) {
    [Environment]::SetEnvironmentVariable($key, $null, "Process")
  }
  foreach ($line in Get-Content -LiteralPath $env:PRISM_ENV_FILE) {
    if ($line -match '^([A-Z0-9_]+)=(.*)$') {
      $key = $Matches[1]
      $value = $Matches[2] | ConvertFrom-Json
      [Environment]::SetEnvironmentVariable($key, [string]$value, "Process")
    }
  }
}

function Assert-LocalDevelopmentEnvironment {
  if ($env:PRISM_LOCAL_DEV -ne "1" -or -not $env:PRISM_ENV_FILE) {
    throw "Local database preparation is required before launching Prism."
  }
  & node.exe (Join-Path $root "scripts\local-supabase.mjs") check
  if ($LASTEXITCODE -ne 0) { throw "Refusing to launch Prism against an unexpected database." }
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
    Write-Warning "Stack may still be starting. Check: docker compose -f $($script:composeFile) ps"
    Write-Warning "Logs: docker compose -f $($script:composeFile) logs -f"
    throw "Docker services did not become ready: $names"
  }
}

function Show-Urls {
  Write-Host ""
  Write-Host "P.R.I.S.M is running against local Supabase."
  $databaseInfo = Get-Content -LiteralPath (Join-Path $root ".local-dev\database.json") -Raw | ConvertFrom-Json
  Write-Host "  Studio:   $($databaseInfo.studioUrl)"
  Write-Host "  Client:   http://localhost:$($prismPorts.client)/"
  Write-Host "  Supplier: http://localhost:$($prismPorts.supplier)/"
  Write-Host "  Guest:    http://localhost:$($prismPorts.guest)/"
  Write-Host "  Event:    http://localhost:$($prismPorts.event)/"
  Write-Host "  API:      http://localhost:$($prismPorts.api)/health"
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
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden | Out-Null
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
  Prepare-LocalDatabase
  Assert-LocalDevelopmentEnvironment
  if ($DatabaseOnly) { exit 0 }

  $script:composeFile = if ($Dev) { "compose.dev.yml" } else { "compose.local.yml" }
  $modeLabel = if ($Dev) { "dev (hot reload)" } else { "built images" }

  Write-Host "Starting P.R.I.S.M with Docker ($modeLabel) using $composeFile"

  # Parallel multi-service monorepo builds can crash Docker Desktop on Windows.
  $env:COMPOSE_PARALLEL_LIMIT = "1"
  $env:DOCKER_BUILDKIT = "1"

  # Compose Bake can build several targets concurrently despite PARALLEL_LIMIT.
  # Build one service at a time; dev services all share the API's image tag.
  if (-not $SkipBuild) {
    $buildServices = if ($Dev) { @("api") } else { @("api", "client", "supplier", "guest", "event") }
    foreach ($service in $buildServices) {
      & docker compose -f $composeFile build $service
      if ($LASTEXITCODE -ne 0) { throw "Docker build failed for $service. Apps were not started." }
    }
  }

  function Invoke-DockerComposeUp {
    $composeArgs = @("compose", "-f", $composeFile, "up", "--no-build")
    if ($Dev -and $Foreground) { $composeArgs += "--watch" }
    if (-not $Foreground) { $composeArgs += "-d" }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      & docker @composeArgs | Out-Host
      return $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $prev
    }
  }

  $exitCode = Invoke-DockerComposeUp
  if ($exitCode -ne 0) {
    Write-Warning "docker compose up failed (exit $exitCode). Retrying once..."
    Start-Sleep -Seconds 5
    if (-not (Test-DockerEngineReady)) {
      Wait-DockerEngine
    }
    $exitCode = Invoke-DockerComposeUp
  }
  if ($exitCode -ne 0) {
    throw "docker compose up failed with exit code $exitCode."
  }

  if ($Foreground) {
    exit 0
  }

  if ($Dev) {
    & node.exe (Join-Path $root "scripts\compose-watch.mjs") start
    if ($LASTEXITCODE -ne 0) { throw "Compose Watch could not start." }
  }

  $targets = @(
    @{ Name = "api"; Url = "http://localhost:$($prismPorts.api)/health" },
    @{ Name = "client"; Url = "http://localhost:$($prismPorts.client)/" },
    @{ Name = "supplier"; Url = "http://localhost:$($prismPorts.supplier)/" },
    @{ Name = "guest"; Url = "http://localhost:$($prismPorts.guest)/" },
    @{ Name = "event"; Url = "http://localhost:$($prismPorts.event)/" }
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
  [pscustomobject]@{ Name = "api"; Directory = "apps\api"; Port = $prismPorts.api; Url = "http://localhost:$($prismPorts.api)/health"; Args = @("run", $npmScript) },
  [pscustomobject]@{ Name = "client"; Directory = "apps\client"; Port = $prismPorts.client; Url = "http://localhost:$($prismPorts.client)/"; Args = @("run", $npmScript) },
  [pscustomobject]@{ Name = "supplier"; Directory = "apps\supplier"; Port = $prismPorts.supplier; Url = "http://localhost:$($prismPorts.supplier)/"; Args = @("run", $npmScript) },
  [pscustomobject]@{ Name = "guest"; Directory = "apps\guest"; Port = $prismPorts.guest; Url = "http://localhost:$($prismPorts.guest)/"; Args = @("run", $npmScript) },
  [pscustomobject]@{ Name = "event"; Directory = "apps\event"; Port = $prismPorts.event; Url = "http://localhost:$($prismPorts.event)/"; Args = @("run", $npmScript) }
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

Assert-Command -Name "npm.cmd"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

foreach ($app in $apps) {
  $directory = Join-Path $root $app.Directory
  if (-not (Test-Path -LiteralPath (Join-Path $directory "package.json"))) {
    throw "Missing package.json in $($app.Directory)."
  }
}

if (-not $NoPortCleanup) {
  Write-Host "Port cleanup is delegated to the lease-aware API and portal guards."
}

Ensure-WorkspaceInstall
Assert-Command -Name "docker"
Wait-DockerEngine
Prepare-LocalDatabase
Assert-LocalDevelopmentEnvironment
if ($DatabaseOnly) { exit 0 }

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
Assert-LocalDevelopmentEnvironment

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
