# Bash completion for fpasoterm. Install with: source <(fpasoterm --completion bash)

_fpasoterm_profile_names() {
  command fpasoterm --profile-list 2>/dev/null | sed -n 's/^  //p'
}

_fpasoterm_plugin_names() {
  command fpasoterm --plugin-list 2>/dev/null | sed -n 's/^  plugins\/\([^ ]*\).*/\1/p'
}

_fpasoterm_public_plugin_ports() {
  command fpasoterm --plugin-search 2>/dev/null \
    | sed -n 's/^    install: fpasoterm --plugin-install \([^ ]*\) --enable$/\1/p'
}

_fpasoterm_local_plugin_ports() {
  local ports_dir='' index manifest port_dir
  for ((index = 0; index < ${#COMP_WORDS[@]}; index += 1)); do
    if [[ "${COMP_WORDS[index]}" == '--plugin-ports-dir' ]]; then
      ports_dir="${COMP_WORDS[index + 1]}"
      break
    fi
  done
  [[ -n "$ports_dir" && -d "$ports_dir/ports" ]] || return

  while IFS= read -r manifest; do
    port_dir="${manifest%/port.toml}"
    printf '%s\n' "${port_dir#"$ports_dir"/ports/}"
  done < <(find "$ports_dir/ports" -type f -name port.toml -print 2>/dev/null)
}

_fpasoterm_plugin_install_ports() {
  local local_ports
  local_ports="$(_fpasoterm_local_plugin_ports)"
  if [[ -n "$local_ports" ]]; then
    printf '%s\n' "$local_ports"
  else
    _fpasoterm_public_plugin_ports
  fi
}

_fpasoterm() {
  local cur prev options
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD - 1]}"
  options='-h --help -v --version --update-check --doctor -l --list -q --close --broadcast --broadcast-target --broadcast-sync -d --dev -F --foreground -C --console-diagnostics -c --config -p --profile --profile-list --show-config --config-check --config-path --config-example --diagnostics --open-log-dir --copy-diagnostics --plugin-list --plugin-path --plugin-info --plugin-uninstall --plugin-search --plugin-install --plugin-ports-dir --plugin-install-file --force --enable --update-config --prune-config --setup-sync --sync-status --sync-clean --sync-diagnostics --self-update --self-update-checkout --update-desktop -s --shell -o --cwd -e --command -t --title -b --titlebar-color -r --reset-window-state -R --reset-config --enable-plugin --disable-plugin --plugin-enable-all --plugin-disable-all --plugin-enable --plugin-disable -W --width -H --height -z --size -k --debug-keys --disable-dmabuf --completion --completion-install --completion-uninstall'

  case "$prev" in
    --completion|--completion-install|--completion-uninstall)
      COMPREPLY=( $(compgen -W 'bash zsh fish powershell' -- "$cur") )
      return
      ;;
    --profile|-p)
      COMPREPLY=( $(compgen -W "$(_fpasoterm_profile_names)" -- "$cur") )
      return
      ;;
    --enable-plugin|--disable-plugin|--plugin-enable|--plugin-disable|--plugin-info|--plugin-uninstall)
      COMPREPLY=( $(compgen -W "$(_fpasoterm_plugin_names)" -- "$cur") )
      return
      ;;
    --plugin-install)
      COMPREPLY=( $(compgen -W "$(_fpasoterm_plugin_install_ports)" -- "$cur") )
      return
      ;;
    --plugin-ports-dir|--plugin-install-file)
      COMPREPLY=( $(compgen -f -- "$cur") )
      return
      ;;
    --config|-c|--cwd|-o)
      COMPREPLY=( $(compgen -f -- "$cur") )
      return
      ;;
    --shell|-s)
      COMPREPLY=( $(compgen -c -- "$cur") )
      return
      ;;
    --close|-q|--broadcast-target)
      COMPREPLY=( $(compgen -W "all $(command fpasoterm --list 2>/dev/null | awk '{print $1}')" -- "$cur") )
      return
      ;;
  esac

  COMPREPLY=( $(compgen -W "$options" -- "$cur") )
}

complete -F _fpasoterm fpasoterm bin/fpasoterm ./bin/fpasoterm
