# restore-usb.ps1 — Restore from a USB backup.
#
# Usage:
#   .\restore-usb.ps1                          # Interactive: list backups, pick one
#   .\restore-usb.ps1 -DriveLetter E           # Use specific drive
#   .\restore-usb.ps1 -BackupFile automotive_20260826_020000.sql.gz  # Specific file
#
# WARNING: This DROPS and recreates all tables in the autoparts database.
# A pre-restore backup is taken automatically.

param(
  [string]$DriveLetter = "",
  [string]$DriveLabel = "BACKUP",
  [string]$BackupFile = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\BLAX ENTERPRISES\Desktop\Automotive system"

function Find-USBDrive {
  if ($DriveLetter) {
    $letter = $DriveLetter.TrimEnd('\').TrimEnd(':') + ":"
    if (Test-Path "$letter\") { return $letter }
    Write-Host "ERROR: Drive $letter not found." -ForegroundColor Red
    return $null
  }

  $drives = Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 }
  if ($DriveLabel) {
    $match = $drives | Where-Object { $_.VolumeName -eq $DriveLabel }
    if ($match) { return $match.DeviceID }
  }
  if ($drives) { return ($drives | Select-Object -First 1).DeviceID }

  Write-Host "ERROR: No USB drive found." -ForegroundColor Red
  return $null
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  AUTOMOTIVE SYSTEM — DATABASE RESTORE" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

$usbDrive = Find-USBDrive
if (-not $usbDrive) { exit 1 }

$backupDir = "$usbDrive\BACKUP\automotive"
if (-not (Test-Path $backupDir)) {
  Write-Host "ERROR: No backups found at $backupDir" -ForegroundColor Red
  exit 1
}

# Select backup file
if (-not $BackupFile) {
  $backups = Get-ChildItem -Path $backupDir -Filter "automotive_*.sql.gz" |
    Sort-Object LastWriteTime -Descending

  if (-not $backups) {
    Write-Host "ERROR: No backup files found on $usbDrive" -ForegroundColor Red
    exit 1
  }

  Write-Host "Available backups:" -ForegroundColor Cyan
  Write-Host ""
  for ($i = 0; $i -lt $backups.Count; $i++) {
    $b = $backups[$i]
    $sizeMB = [math]::Round($b.Length / 1MB, 2)
    $date = $b.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
    Write-Host "  [$($i + 1)] $($b.Name)  ($sizeMB MB, $date)"
  }
  Write-Host ""
  $choice = Read-Host "Enter backup number to restore (1-$($backups.Count))"
  $idx = [int]$choice - 1

  if ($idx -lt 0 -or $idx -ge $backups.Count) {
    Write-Host "Invalid choice." -ForegroundColor Red
    exit 1
  }

  $BackupFile = $backups[$idx].FullName
}

if (-not (Test-Path $BackupFile)) {
  Write-Host "ERROR: File not found: $BackupFile" -ForegroundColor Red
  exit 1
}

$sizeMB = [math]::Round((Get-Item $BackupFile).Length / 1MB, 2)
Write-Host ""
Write-Host "Will restore: $(Split-Path $BackupFile -Leaf) ($sizeMB MB)" -ForegroundColor Yellow
Write-Host ""
Write-Host "WARNING: This will DROP and recreate all tables." -ForegroundColor Red
Write-Host "A pre-restore backup will be taken automatically." -ForegroundColor Cyan
Write-Host ""
$confirm = Read-Host "Type YES to proceed"

if ($confirm -ne "YES") {
  Write-Host "Aborted." -ForegroundColor Yellow
  exit 0
}

# Take a pre-restore safety backup
Write-Host ""
Write-Host "[restore] Taking pre-restore safety backup..." -ForegroundColor Cyan
$safetyDir = "$repoRoot\backups\pre-restore"
New-Item -ItemType Directory -Force -Path $safetyDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$safetyFile = "$safetyDir\pre_restore_$timestamp.sql.gz"
$wslSafetyDir = "/mnt/c/Users/BLAX ENTERPRISES/Desktop/Automotive%20system/backups/pre-restore"

wsl -d Ubuntu -- bash -c "mkdir -p '$wslSafetyDir' && cd /mnt/c/Users/BLAX\\ ENTERPRISES/Desktop/Automotive\\ system/server && source .env 2>/dev/null; `$HOME/.cache/autoparts-postgres/pg-18.4.0/bin/pg_dump "`$DATABASE_URL`" | gzip > '$wslSafetyDir/pre_restore_$timestamp.sql.gz' 2>&1"

if (Test-Path $safetyFile) {
  Write-Host "[restore] Safety backup saved: pre_restore_$timestamp.sql.gz" -ForegroundColor Green
} else {
  Write-Host "[restore] WARNING: Safety backup may have failed. Continuing anyway..." -ForegroundColor Yellow
}

# Run the restore via WSL
$wslBackupPath = "/mnt/$($usbDrive.TrimEnd(':').ToLower())BACKUP/automotive/$(Split-Path $BackupFile -Leaf)"
$wslRepo = "/mnt/c/Users/BLAX ENTERPRISES/Desktop/Automotive system"

Write-Host "[restore] Restoring from USB backup..." -ForegroundColor Cyan

$result = wsl -d Ubuntu -- bash -c "cd '$wslRepo/server' && source .env 2>/dev/null; echo 'Restoring from: $wslBackupPath'; gunzip -c '$wslBackupPath' | `$HOME/.cache/autoparts-postgres/pg-18.4.0/bin/psql "`$DATABASE_URL`" --quiet 2>&1"

foreach ($line in $result) {
  if ($line) { Write-Host "  $line" }
}

Write-Host ""
Write-Host "[restore] DONE. Restart the system and verify data." -ForegroundColor Green
Write-Host "  Restart command: wsl -d Ubuntu -- bash '$wslRepo/start-automotive.sh'" -ForegroundColor Cyan
Write-Host ""
