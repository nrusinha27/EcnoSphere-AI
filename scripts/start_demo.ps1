# =============================================================================
# EconoSphere AI -- Automated Demonstration Startup Script
# =============================================================================
# Usage: .\scripts\start_demo.ps1
#
# Launches the required services for university EDI demonstration:
#   1. Verifies PostgreSQL on port 5432 (Mandatory)
#   2. Checks Docker Desktop & launches Redis (Required for Stage 1 simulations)
#   3. Safely checks ports 8000 and 3000 (only stops previous project-owned processes)
#   4. Starts FastAPI backend on port 8000
#   5. Starts RQ Simulation Worker (if Redis is active)
#   6. Starts Next.js frontend on port 3000
#   7. Validates API health endpoint
# =============================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   EconoSphere AI -- Stage 5 Demonstration Startup" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Check Python virtual environment
$PythonExe = Join-Path $ProjectRoot "apps\api\.venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Error "Python virtual environment not found at: $PythonExe`nPlease run setup in apps/api first."
    exit 1
}
Write-Host "[OK] Python virtual environment detected." -ForegroundColor Green

# 2. Check Node.js and npm
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Error "Node.js is not found on PATH. Please install Node.js v18+."
    exit 1
}
Write-Host "[OK] Node.js runtime detected: $(node --version)" -ForegroundColor Green

# 3. Check PostgreSQL database (port 5432)
Write-Host "Checking PostgreSQL on port 5432..." -NoNewline
$PostgresActive = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet
if (-not $PostgresActive) {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "PostgreSQL is not listening on port 5432.`nPlease start your native PostgreSQL service before launching."
    exit 1
}
Write-Host " [CONNECTED]" -ForegroundColor Green

# 4. Check Docker & Redis (Required for Stage 1 simulations)
Write-Host "Checking Docker infrastructure for Redis..." -NoNewline
$DockerActive = $false
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $DockerActive = $true }
} catch {
    $DockerActive = $false
}

$RedisActive = $false
if ($DockerActive) {
    Write-Host " [DOCKER RUNNING]" -ForegroundColor Green
    Write-Host "Starting Redis container via Compose..." -ForegroundColor Yellow
    docker compose -f (Join-Path $ProjectRoot "infrastructure\docker\docker-compose.yml") up -d redis
    Start-Sleep -Seconds 2
    $RedisActive = Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet
    if ($RedisActive) {
        Write-Host "[OK] Redis is running on port 6379." -ForegroundColor Green
    }
} else {
    Write-Host " [DOCKER OFFLINE]" -ForegroundColor Yellow
    Write-Host "  -> Notice: Docker Desktop is not running on this machine." -ForegroundColor Yellow
    Write-Host "  -> Stage 2 (GDP Forecasting) and Stage 3 (Country Comparison) will function 100% natively." -ForegroundColor Cyan
    Write-Host "  -> Stage 1 (Crisis Simulations) requires Redis. Start Docker Desktop if demonstrating Stage 1." -ForegroundColor Yellow
}

# 5. Safe port verification (stops ONLY project-owned processes, refuses to kill unrelated processes)
$port8000Conn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($port8000Conn) {
    $proc8000 = Get-Process -Id $port8000Conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc8000) {
        $procPath = $proc8000.Path
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc8000.Id)" -ErrorAction SilentlyContinue).CommandLine
        $isProject = ($procPath -like "*EconoSphere AI*" -or $cmdLine -like "*app.main:app*" -or $procPath -like "*apps\api\.venv*")
        if ($isProject) {
            Write-Host "Terminating previous EconoSphere API process on port 8000 (PID: $($proc8000.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $proc8000.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        } else {
            Write-Error "Port 8000 is occupied by an unrelated process ($($proc8000.ProcessName), PID: $($proc8000.Id)). Please free port 8000 manually before launching."
            exit 1
        }
    }
}

$port3000Conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000Conn) {
    $proc3000 = Get-Process -Id $port3000Conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc3000) {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc3000.Id)" -ErrorAction SilentlyContinue).CommandLine
        $isProject = ($cmdLine -like "*EconoSphere AI*" -or $cmdLine -like "*next*")
        if ($isProject) {
            Write-Host "Terminating previous Next.js process on port 3000 (PID: $($proc3000.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $proc3000.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        } else {
            Write-Error "Port 3000 is occupied by an unrelated process ($($proc3000.ProcessName), PID: $($proc3000.Id)). Please free port 3000 manually before launching."
            exit 1
        }
    }
}

# 6. Start FastAPI Backend in new window
Write-Host "`nLaunching FastAPI backend server (Port 8000)..." -ForegroundColor Cyan
$ApiDir = Join-Path $ProjectRoot "apps\api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ApiDir'; & '$PythonExe' -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

# 7. Start RQ Worker if Redis is active
if ($RedisActive) {
    Write-Host "Launching RQ simulation worker..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ApiDir'; & '$PythonExe' workers\simulation_worker.py"
}

# 8. Start Next.js Frontend in new window
Write-Host "Launching Next.js frontend dashboard (Port 3000)..." -ForegroundColor Cyan
$WebDir = Join-Path $ProjectRoot "apps\web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$WebDir'; npm run dev"

# 9. Health verification loop (wait up to 15 seconds)
Write-Host "`nWaiting for FastAPI backend to become healthy..." -NoNewline
$BackendHealthy = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response -and $response.services.postgres -eq "ok") {
            $BackendHealthy = $true
            break
        }
    } catch {}
    Write-Host "." -NoNewline
}

if ($BackendHealthy) {
    Write-Host " [HEALTHY]" -ForegroundColor Green
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "   EconoSphere AI is ready for demonstration!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "  * Web Dashboard:       http://localhost:3000" -ForegroundColor White
    Write-Host "  * Country Comparison:  http://localhost:3000/dashboard/compare" -ForegroundColor White
    Write-Host "  * GDP Forecasting:     http://localhost:3000/dashboard/forecast" -ForegroundColor White
    Write-Host "  * Crisis Simulation:   http://localhost:3000/dashboard/simulation" -ForegroundColor White
    Write-Host "  * Interactive API:     http://localhost:8000/docs" -ForegroundColor White
    Write-Host "`nTo stop all services cleanly, run: .\scripts\stop_demo.ps1`n" -ForegroundColor Cyan
} else {
    Write-Host " [TIMEOUT]" -ForegroundColor Yellow
    Write-Host "Backend process was launched. Check the spawned Uvicorn terminal for startup logs." -ForegroundColor Yellow
}
