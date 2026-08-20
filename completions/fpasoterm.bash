# Bash completion for fpasoterm. Install with: source <(fpasoterm --completion bash)

_fpasoterm_profile_names() {
  command fpasoterm --profile-list 2>/dev/null | sed -n 's/^  //p'
}

_fpasoterm_plugin_names() {
  command fpasoterm --plugin-list 2>/dev/null | sed -n 's/^  plugins\/\([^ ]*\).*/\1/p'
}

_fpasoterm() {
  local cur prev options
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD - 1]}"
  options='-h --help -v --version --update-check -l --list -q --close --broadcast --broadcast-target --broadcast-sync -d --dev -F --foreground -C --console-diagnostics -c --config -p --profile --profile-list --show-config --config-check --config-path --config-example --diagnostics --open-log-dir --copy-diagnostics --plugin-list --plugin-path --plugin-info --plugin-uninstall --plugin-search --plugin-install --plugin-install-force --enable --update-config --prune-config --setup-sync --sync-status --sync-clean --sync-diagnostics --self-update --self-update-checkout --update-desktop -s --shell -e --command -t --title -b --titlebar-color -r --reset-window-state -R --reset-config --enable-plugin --disable-plugin --plugin-enable-all --plugin-disable-all --plugin-enable --plugin-disable -W --width -H --height -z --size -k --debug-keys --x11 --debug-opaque-terminal --disable-dmabuf --completion --completion-install --completion-uninstall'

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
      COMPREPLY=( $(compgen -W 'terminal/hello terminal/welcome-banner terminal/status-banner terminal/theme appearance/amber appearance/teal appearance/high-contrast productivity/git-status productivity/session-marker' -- "$cur") )
      return
      ;;
    --config|-c)
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

complete -F _fpasoterm fpasoterm
