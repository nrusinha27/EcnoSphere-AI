# =============================================================================
# EconoSphere AI — Automated Demonstration Shutdown Script
# =============================================================================
# Usage: .\scripts\stop_demo.ps1
#
# Terminates running demonstration processes cleanly and safely:
#   1. FastAPI Backend (port 8000 — project processes only)
#   2. Next.js Frontend (port 3000 — project processes only)
#   3. RQ Simulation Worker (simulation_worker.py)
#   4. Redis and Neo4j Docker containers
# =============================================================================

$ErrorActionPreference = "SilentlyContinue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "`nStopping EconoSphere AI demonstration services..." -ForegroundColor Yellow

# 1. Terminate project-owned process on Port 8000 (FastAPI)
$port8000Conn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($port8000Conn) {
    $proc8000 = Get-Process -Id $port8000Conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc8000) {
        $procPath = $proc8000.Path
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc8000.Id)" -ErrorAction SilentlyContinue).CommandLine
        $isProject = ($procPath -like "*EconoSphere AI*" -or $cmdLine -like "*app.main:app*" -or $procPath -like "*apps\api\.venv*")
        if ($isProject) {
            Write-Host "Terminating EconoSphere API server (Port 8000, PID: $($proc8000.Id))..." -ForegroundColor Cyan
            Stop-Process -Id $proc8000.Id -Force
        } else {
            Write-Host "Skipping Port 8000: occupied by non-project process ($($proc8000.ProcessName), PID: $($proc8000.Id))." -ForegroundColor Yellow
        }
    }
}

# 2. Terminate project-owned process on Port 3000 (Next.js)
$port3000Conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000Conn) {
    $proc3000 = Get-Process -Id $port3000Conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc3000) {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc3000.Id)" -ErrorAction SilentlyContinue).CommandLine
        $isProject = ($cmdLine -like "*EconoSphere AI*" -or $cmdLine -like "*next*")
        if ($isProject) {
            Write-Host "Terminating Next.js web server (Port 3000, PID: $($proc3000.Id))..." -ForegroundColor Cyan
            Stop-Process -Id $proc3000.Id -Force
        } else {
            Write-Host "Skipping Port 3000: occupied by non-project process ($($proc3000.ProcessName), PID: $($proc3000.Id))." -ForegroundColor Yellow
        }
    }
}

# 3. Stop background python simulation worker processes (query Win32_Process for reliable CommandLine)
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -like "python*" -and $_.CommandLine -like "*simulation_worker*" -and $_.CommandLine -like "*EconoSphere AI*"
} | ForEach-Object {
    $workerPid = $_.ProcessId
    Write-Host "Terminating EconoSphere simulation worker process (PID: $workerPid)..." -ForegroundColor Cyan
    Stop-Process -Id $workerPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    if (-not (Get-Process -Id $workerPid -ErrorAction SilentlyContinue)) {
        Write-Host "Verified worker process $workerPid stopped." -ForegroundColor Green
    }
}

# 4. Stop Docker Compose infrastructure services cleanly
try {
    $composeFile = Join-Path $ProjectRoot "infrastructure\docker\docker-compose.yml"
    docker compose -f $composeFile stop redis neo4j 2>$null
    Write-Host "Docker Compose infrastructure containers stopped." -ForegroundColor Cyan
} catch {}

# 5. Verify ports are clear
Start-Sleep -Seconds 1
$active8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$active3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if (-not $active8000 -and -not $active3000) {
    Write-Host "`n[SUCCESS] EconoSphere AI services stopped cleanly. Ports 8000 and 3000 are freed.`n" -ForegroundColor Green
} else {
    Write-Host "`n[INFO] Shutdown complete. Port status: Port 8000: $(if ($active8000) {'In Use'} else {'Free'}), Port 3000: $(if ($active3000) {'In Use'} else {'Free'})." -ForegroundColor Cyan
}
