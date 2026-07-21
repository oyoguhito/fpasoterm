$ErrorActionPreference = 'Stop'

# Resolve the default config path relative to this script.
$ConfigPath = Join-Path $PSScriptRoot 'config\default-appearance.toml'

# Emit fpasoterm OSC 777 so the running window restores the default appearance.
[Console]::Write("`e]777;config=$ConfigPath`a`r`n")
