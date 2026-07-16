#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
config_path="$script_dir/config/runtime-appearance.toml"

printf '\033]777;config=%s\a\r\n' "$config_path"
