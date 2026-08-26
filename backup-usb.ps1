# backup-usb.ps1 — Automated nightly backup to USB drive via WSL.
#
# Usage:
#   .\backup-usb.ps1                    # Auto-detect USB drive
#   .\backup-usb.ps1 -DriveLetter E     # Use specific drive
#   .\backup-usb.ps1 -DriveLabel BACKUP # Find drive by volume label
#
# The script:
#   1. Detects or locates the USB drive
#   2. Creates BACKUP/automotive/ on the drive
#   3. Calls WSL to run pg_dump via the existing backup.sh
#   4. Retains 30 days of backups on the USB
#   5. Logs results to the USB drive

param(
  [string]$DriveLetter = "",
  [string]$DriveLabel = "BACKUP"
)

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\BLAX ENTERPRISES\Desktop\Automotive system"
$logFile = "$repoRoot\logs\backup.log"

# Ensure log directory exists
New-Item -ItemType Directory -Force -Path "$repoRoot\logs" | Out-Null

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$timestamp] $Message"
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

function Find-USBDrive {
  # If a drive letter was specified, use it directly
  if ($DriveLetter) {
    $letter = $DriveLetter.TrimEnd('\').TrimEnd(':') + ":"
    if (Test-Path "$letter\") {
      return $letter
    }
    Write-Log "ERROR: Drive $letter not found"
    return $null
  }

  # Find removable drives (USB sticks, external HDDs)
  $drives = Get-WmiObject Win32_LogicalDisk | Where-Object {
    $_.DriveType -eq 2  # 2 = Removable disk
  }

  # Try to match by volume label first
  if ($DriveLabel) {
    $match = $drives | Where-Object { $_.VolumeName -eq $DriveLabel }
    if ($match) {
      return $match.DeviceID
    }
  }

  # If no labeled match, use the first removable drive
  if ($drives) {
    $drive = $drives | Select-Object -First 1
    Write-Log "Using removable drive: $($drive.DeviceID) ($($drive.VolumeName))"
    return $drive.DeviceID
  }

  Write-Log "ERROR: No USB drive found. Plug in a USB drive and try again."
  Write-Log "TIP: Label your USB drive '$DriveLabel' for automatic detection."
  return $null
}

# --- Main ---

Write-Log "=== Backup Started ==="

$usbDrive = Find-USBDrive
if (-not $usbDrive) {
  Write-Log "FAILED: No USB drive available. Backup aborted."
  exit 1
}

$backupDir = "$usbDrive\BACKUP\automotive"
$wslBackupDir = "/mnt/$($usbDrive.TrimEnd(':').ToLower())BACKUP/automotive"

# Create backup directory on USB
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Write-Log "USB drive: $usbDrive"
Write-Log "Backup dir: $backupDir"

# Verify USB has enough space (minimum 100 MB free)
$drive = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='$usbDrive'"
$freeMB = [math]::Round($drive.FreeSpace / 1MB, 1)
if ($freeMB -lt 100) {
  Write-Log "WARNING: Only ${freeMB} MB free on USB drive. Backups may fail."
}

# Run the backup via WSL
Write-Log "Running pg_dump via WSL..."

$result = wsl -d Ubuntu -- bash -c "BACKUPS_ROOT='$wslBackupDir' bash '$(
  # Convert Windows path to WSL path for the backup script
  $wslRepo = "/mnt/c/Users/BLAX ENTERPRISES/Desktop/Automotive system"
  "$wslRepo/scripts/backup.sh"
)' automotive 2>&1"

# Log the WSL output
foreach ($line in $result) {
  if ($line) { Write-Log "  $line" }
}

# Verify backup was created
$latestBackup = Get-ChildItem -Path $backupDir -Filter "automotive_*.sql.gz" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($latestBackup) {
  $sizeMB = [math]::Round($latestBackup.Length / 1MB, 2)
  Write-Log "SUCCESS: Latest backup $($latestBackup.Name) ($sizeMB MB)"

  # Write a manifest file for easy restore
  $manifest = @{
    lastBackup = $latestBackup.Name
    timestamp = (Get-Date -Format "o")
    sizeMB = $sizeMB
    driveLetter = $usbDrive
  } | ConvertTo-Json

  Set-Content -Path "$backupDir\manifest.json" -Value $manifest
} else {
  Write-Log "FAILED: No backup file found after run. Check WSL output above."
  exit 1
}

Write-Log "=== Backup Complete ==="
