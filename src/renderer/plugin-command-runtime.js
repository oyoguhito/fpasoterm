// Small, DOM-independent runtime for plugin command outcomes. Keeping this
// separate from renderer bootstrap lets the normal and error paths be tested
// without starting a native WebView.
(function exposePluginCommandRuntime(root, factory) {
  const runtime = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }
  root.fpasotermPluginCommandRuntime = runtime;
})(globalThis, () => {
  function pluginCommandErrorDetail(error) {
    return [error?.name, error?.message, error?.stack || String(error)]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join('\n');
  }

  async function runPluginCommand({
    commandId,
    args,
    commands,
    closeMenu,
    showStatus,
    showDiagnostic,
    begin,
    finish,
  }) {
    const command = commands.get(commandId);
    if (!command) {
      return { ran: false, ok: false };
    }
    closeMenu();
    showStatus(`command started: ${commandId}`);
    begin();
    try {
      await command.handler(args);
      showStatus(`command completed: ${commandId}`);
      return { ran: true, ok: true };
    } catch (error) {
      const detail = pluginCommandErrorDetail(error);
      showStatus(`command failed: ${commandId}\n${detail}`, 'error');
      showDiagnostic(`plugin command ${commandId} failed: ${detail}`);
      return { ran: true, ok: false, detail };
    } finally {
      finish();
    }
  }

  function closePluginCommandStatus(panel, focusTerminalInput) {
    if (panel) {
      panel.hidden = true;
    }
    focusTerminalInput();
  }

  return {
    closePluginCommandStatus,
    pluginCommandErrorDetail,
    runPluginCommand,
  };
});
