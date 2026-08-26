# setup-backup-task.ps1 — Register nightly USB backup task.
# Run this ONCE as Administrator after plugging in your USB drive.
#
# The task runs every day at 2:00 AM. If no USB drive is plugged in,
# the backup skips gracefully and logs the failure.

$taskName = "AutomotiveBackup"
$scriptPath = "C:\Users\BLAX ENTERPRISES\Desktop\Automotive system\backup-usb.ps1"

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""

# Run daily at 2:00 AM
$trigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 5)

# Run whether user is logged on or not (requires password)
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Nightly backup of Automotive System PostgreSQL to USB drive" `
  -Force

Write-Host ""
Write-Host "Done. '$taskName' registered for daily backup at 2:00 AM." -ForegroundColor Green
Write-Host ""
Write-Host "REQUIREMENTS:" -ForegroundColor Yellow
Write-Host "  1. Plug in a USB drive before the backup runs"
Write-Host "  2. Label the USB drive 'BACKUP' for auto-detection"
Write-Host "     (or run: .\backup-usb.ps1 -DriveLetter X)"
Write-Host ""
Write-Host "Logs: $repoRoot\logs\backup.log" -ForegroundColor Cyan
Write-Host "Backups: <USB>/BACKUP/automotive/" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test now: .\backup-usb.ps1" -ForegroundColor Yellow
