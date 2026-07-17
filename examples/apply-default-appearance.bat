@echo off
setlocal

rem Resolve the default config path relative to this batch file.
set "CONFIG_PATH=%~dp0config\default-appearance.toml"

rem Emit fpasoterm OSC 777 using Windows PowerShell, which is available on supported Windows installs.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$esc=[char]27; $bel=[char]7; [Console]::Write($esc + ']777;config=' + $env:CONFIG_PATH + $bel + [char]13 + [char]10)"
