$ErrorActionPreference = 'Stop'

# Resolve the sample config path relative to this script.
$ConfigPath = Join-Path $PSScriptRoot 'config\runtime-appearance.toml'

# Emit fpasoterm OSC 777 so the running window applies the sample appearance.
[Console]::Write("`e]777;config=$ConfigPath`a`r`n")
