# Register Automotive System to auto-start on Windows login.
# Run this ONCE as Administrator.

$taskName = "AutomotiveSystem"
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"C:\Users\BLAX ENTERPRISES\Desktop\Automotive system\start-automotive.ps1`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Auto-start Automotive System (PostgreSQL + Express on :4100)" -Force

Write-Host ""
Write-Host "Done. '$taskName' registered to start at login." -ForegroundColor Green
Write-Host "The system will be available at http://localhost:4100 after login." -ForegroundColor Cyan
