# PowerShell completion for fpasoterm. Install with:
# fpasoterm --completion powershell | Out-String | Invoke-Expression

$fpasotermCompletion = {
  param($wordToComplete, $commandAst, $cursorPosition)

  $shells = @('bash', 'zsh', 'fish', 'powershell')
  $options = @(
    @('--help', 'Show help'), @('-h', 'Show help'), @('--version', 'Show version and build commit'), @('-v', 'Show version and build commit'), @('--update-check', 'Compare installed version with npm latest'), @('--doctor', 'Check updates, npm audit, and config health'),
    @('--list', 'List running windows'), @('-l', 'List running windows'), @('--close', 'Close a PID, exact title, or all'), @('-q', 'Close a PID, exact title, or all'),
    @('--broadcast', 'Send text to local windows'), @('--broadcast-target', 'Limit Broadcast targets'), @('--broadcast-sync', 'Include the sync channel'),
    @('--dev', 'Rebuild local debug binary'), @('-d', 'Rebuild local debug binary'), @('--foreground', 'Keep launcher attached'), @('-F', 'Keep launcher attached'),
    @('--console-diagnostics', 'Print diagnostics to stderr'), @('-C', 'Print diagnostics to stderr'), @('--config', 'Use a config.toml file'), @('-c', 'Use a config.toml file'),
    @('--profile', 'Apply a named profile'), @('-p', 'Apply a named profile'), @('--profile-list', 'List named profiles'), @('--show-config', 'Print resolved config'),
    @('--config-check', 'Validate config'), @('--config-path', 'Print config path'), @('--config-example', 'Print config example'), @('--diagnostics', 'Print diagnostics report'),
    @('--open-log-dir', 'Open terminal log directory'), @('--copy-diagnostics', 'Copy diagnostics report'), @('--plugin-list', 'List local User/plugins files'), @('--plugin-path', 'Print plugin directory'),
    @('--plugin-info', 'Show plugin information'), @('--plugin-uninstall', 'Remove local plugin files'), @('--plugin-search', 'Search official public plugin ports'), @('--plugin-install', 'Install a port from GitHub or --plugin-ports-dir'), @('--plugin-ports-dir', 'Install --plugin-install from a local checkout'), @('--plugin-install-file', 'Copy a trusted local .js/.ts plugin'), @('--force', 'Replace an existing plugin during install'), @('--enable', 'Enable a plugin installed by an install command'), @('--enable-plugin', 'Enable plugins'), @('--disable-plugin', 'Disable plugins'), @('--plugin-enable', 'Alias for enable-plugin'),
    @('--plugin-disable', 'Alias for disable-plugin'), @('--plugin-enable-all', 'Enable all discovered plugins'), @('--plugin-disable-all', 'Disable all plugins'),
    @('--update-config', 'Add missing config defaults'), @('--prune-config', 'Remove unsupported config settings'), @('--setup-sync', 'Configure a sync folder'),
    @('--sync-status', 'Show sync health'), @('--sync-clean', 'Remove expired sync commands'), @('--sync-diagnostics', 'Print sync diagnostics'),
    @('--self-update', 'Update an npm installation'), @('--self-update-checkout', 'Update a git checkout'), @('--update-desktop', 'Refresh desktop integration'),
    @('--shell', 'Override shell'), @('-s', 'Override shell'), @('--command', 'Run command after launch'), @('-e', 'Run command after launch'),
    @('--title', 'Override titlebar title'), @('-t', 'Override titlebar title'), @('--titlebar-color', 'Override titlebar color'), @('-b', 'Override titlebar color'),
    @('--reset-window-state', 'Delete saved window size'), @('-r', 'Delete saved window size'), @('--reset-config', 'Restore default config'), @('-R', 'Restore default config'),
    @('--width', 'Override window width'), @('-W', 'Override window width'), @('--height', 'Override window height'), @('-H', 'Override window height'),
    @('--size', 'Override window size'), @('-z', 'Override window size'), @('--debug-keys', 'Enable key diagnostics'), @('-k', 'Enable key diagnostics'),
    @('--x11', 'Use the X11 GTK backend'), @('--debug-opaque-terminal', 'Use opaque terminal background'), @('--disable-dmabuf', 'Disable Linux DMA-BUF renderer'),
    @('--completion', 'Print completion script'), @('--completion-install', 'Install persistent completion'), @('--completion-uninstall', 'Remove persistent completion')
  )

  $previous = ''
  if ($commandAst.CommandElements.Count -gt 1) {
    $previous = $commandAst.CommandElements[$commandAst.CommandElements.Count - 2].Extent.Text
  }
  if ($previous -in '--completion', '--completion-install', '--completion-uninstall') {
    foreach ($shell in $shells | Where-Object { $_ -like "$wordToComplete*" }) {
      [System.Management.Automation.CompletionResult]::new($shell, $shell, 'ParameterValue', "fpasoterm completion for $shell")
    }
    return
  }

  foreach ($option in $options | Where-Object { $_[0] -like "$wordToComplete*" }) {
    [System.Management.Automation.CompletionResult]::new($option[0], $option[0], 'ParameterName', $option[1])
  }
}

Register-ArgumentCompleter -Native -CommandName fpasoterm, fpasoterm.cmd, fpasoterm.exe -ScriptBlock $fpasotermCompletion
