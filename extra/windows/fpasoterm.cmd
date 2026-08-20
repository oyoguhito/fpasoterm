@echo off
setlocal DisableDelayedExpansion

rem Console wrapper for the GUI-subsystem fpasoterm.exe beside this file.
rem CLI operations run as a direct child so output and exit codes return to the
rem invoking PowerShell/cmd console; normal launches remain detached.
set "FPASOTERM_EXE=%~dp0fpasoterm.exe"
if not exist "%FPASOTERM_EXE%" (
  echo fpasoterm: executable not found: "%FPASOTERM_EXE%" 1>&2
  exit /b 1
)

:scan
if "%~1"=="" goto run
for %%F in (
  --help -h --version -v --list -l --close -q --show-config
  --profile-list --config-check --config-path --config-example
  --diagnostics --open-log-dir --copy-diagnostics
  --plugin-list --plugin-path --plugin-info
  --enable-plugin --disable-plugin --plugin-enable --plugin-disable
  --plugin-enable-all --plugin-disable-all
  --reset-window-state -r --reset-config -R --update-config --prune-config
  --setup-sync --foreground -F
  --broadcast --broadcast-target --broadcast-sync
) do if /I "%~1"=="%%F" set "FPASOTERM_WAIT=1"
shift
goto scan

:run
if defined FPASOTERM_WAIT (
  call "%FPASOTERM_EXE%" %*
  exit /b %ERRORLEVEL%
)

start "" "%FPASOTERM_EXE%" %*
exit /b 0
