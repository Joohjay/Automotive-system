# Auto-start Automotive System
# Starts PostgreSQL + Express (API + frontend) on port 4100 via WSL

# Ensure WSL is booted before running the startup script
wsl -d Ubuntu -- echo ready

# Run the startup script
wsl -d Ubuntu -- bash -lc "bash '/mnt/c/Users/BLAX ENTERPRISES/Desktop/Automotive system/start-automotive.sh'"
