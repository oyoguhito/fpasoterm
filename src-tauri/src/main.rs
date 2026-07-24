#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WindowEvent};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
// Complete runtime configuration shared with the renderer.
struct RuntimeConfig {
    config: Config,
    config_dir: String,
    config_path: String,
    plugin_urls: Vec<PluginUrl>,
    window_state_path: String,
    diagnostics: Option<DiagnosticsConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
// User-facing configuration grouped by the TOML sections.
struct Config {
    window: WindowConfig,
    terminal: serde_json::Value,
    ime: serde_json::Value,
    plugins: serde_json::Value,
    sync: serde_json::Value,
    logging: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
// Window settings that Tauri must know before the renderer is fully ready.
struct WindowConfig {
    title: String,
    width: u32,
    height: u32,
    min_width: u32,
    min_height: u32,
    background_color: String,
    titlebar_color: String,
    title_locked: bool,
    theme_source: String,
    frame: bool,
    remember_bounds: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
// Resolved plugin script URL exposed to the renderer.
struct PluginUrl {
    name: String,
    url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
// Diagnostics switches passed from the launcher to the backend and renderer.
struct DiagnosticsConfig {
    debug_keys: bool,
    console_diagnostics: bool,
    opaque_terminal: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
// Current xterm.js grid size reported by the renderer.
struct TerminalSize {
    cols: u16,
    rows: u16,
}

#[derive(Debug, Clone, Serialize)]
// Terminal exit payload emitted to the renderer before the window closes.
struct TerminalExit {
    exit_code: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// Optional window bounds requested by the renderer.
struct WindowBoundsRequest {
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Current window bounds returned to the renderer.
struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// Text payload requested by the renderer for sync-folder publishing.
struct SyncWriteRequest {
    text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Current sync-folder state returned to the renderer.
struct SyncStatus {
    enabled: bool,
    provider: String,
    path: String,
    channel: String,
    clipboard_path: String,
    diagnostics_path: String,
    message: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
// A sync-folder item shared between fpasoterm instances.
struct SyncItem {
    schema_version: u8,
    kind: String,
    channel: String,
    source_id: String,
    updated_at: u128,
    text: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// Optional terminal log start request from the renderer.
struct TerminalLogStartRequest {
    path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Current terminal output log state returned to the renderer.
struct TerminalLogStatus {
    enabled: bool,
    active: bool,
    path: String,
    bytes_written: u64,
    message: String,
}

// Active terminal output log file and byte counter.
struct TerminalLog {
    path: String,
    file: File,
    bytes_written: u64,
    max_bytes: u64,
}

// Owns the native PTY session and child shell handles.
struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
}

// Shared runtime state for the active PTY session and recent diagnostics.
struct AppState {
    terminal: Mutex<Option<TerminalSession>>,
    diagnostics: Arc<Mutex<VecDeque<String>>>,
    terminal_log: Arc<Mutex<Option<TerminalLog>>>,
    source_id: String,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            terminal: Mutex::new(None),
            diagnostics: Arc::new(Mutex::new(VecDeque::new())),
            terminal_log: Arc::new(Mutex::new(None)),
            source_id: format!("{}-{}", std::process::id(), now_millis()),
        }
    }
}

const HELP_TEXT: &str = "Usage: fpasoterm [options]\n\nOptions:\n  -h, --help                    Show this help.\n  -d, --dev                     Force Tauri dev runtime when using the Node launcher.\n  -F, --foreground              Keep the launcher attached to the current console.\n  -C, --console-diagnostics     Print diagnostics to stderr as well as the log file.\n  -c, --config <path>           Use a specific config.toml for this launch.\n      --show-config             Print resolved settings and plugin load status, then exit.\n      --self-update             Update an npm-installed package when using the Node launcher.\n      --self-update-checkout    Update a clean git checkout when using the Node launcher.\n      --update-desktop          Reinstall Linux desktop integration when using the Node launcher.\n  -s, --shell <command>         Override the configured shell for this launch.\n  -e, --command <command>       Send a command to the shell after launch.\n  -t, --title <text>            Override the titlebar title for this launch.\n  -b, --titlebar-color <color>  Override the custom titlebar color for this launch.\n  -r, --reset-window-state      Delete saved window size, then exit.\n      --enable-plugin <names>   Enable plugins when using the Node launcher.\n      --disable-plugin <names>  Disable plugins when using the Node launcher.\n  -W, --width <px>              Override the configured window width for this launch.\n  -H, --height <px>             Override the configured window height for this launch.\n  -z, --size <width>x<height>   Override both window dimensions for this launch.\n  -k, --debug-keys              Enable key/composition diagnostics.\n      --debug-opaque-terminal   Use an opaque terminal background for renderer diagnostics.\n      --disable-dmabuf          Set WEBKIT_DISABLE_DMABUF_RENDERER=1 for Linux WebKitGTK diagnostics.\n";

// Starts Tauri and registers window setup plus renderer-callable commands.
fn main() {
    apply_direct_cli_env_overrides();

    if cli_has_flag(&["--help", "-h"]) {
        print_cli_text(HELP_TEXT);
        return;
    }
    if cli_has_flag(&["--show-config"]) {
        print_show_config();
        return;
    }
    if cli_has_flag(&["--reset-window-state", "-r"]) {
        reset_window_state_cli();
        return;
    }

    if env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err()
        && (env::var("FPASOTERM_DISABLE_DMABUF").as_deref() == Ok("1")
            || cli_has_flag(&["--disable-dmabuf"]))
    {
        env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            let config = runtime_config();
            append_diagnostic(
                app.handle(),
                &format!(
                    "resolved startup config title={} titlebarColor={} shell={}",
                    config.config.window.title,
                    config.config.window.titlebar_color,
                    configured_shell(&config.config).unwrap_or_default()
                ),
            );
            if let Some(window) = app.get_webview_window("main") {
                let restore_size =
                    PhysicalSize::new(config.config.window.width, config.config.window.height);
                let _ = window.set_title(&config.config.window.title);
                set_window_icon(&window, app.default_window_icon());
                let _ = window.set_size(restore_size);
                append_diagnostic(
                    app.handle(),
                    &format!(
                        "restoring window size width={} height={}",
                        config.config.window.width, config.config.window.height
                    ),
                );
                let _ = window.set_min_size(Some(tauri::LogicalSize::new(
                    config.config.window.min_width,
                    config.config.window.min_height,
                )));
                schedule_startup_size_restore(
                    app.handle().clone(),
                    window,
                    config.window_state_path.clone(),
                    config.config.window.remember_bounds,
                    restore_size,
                );
            }
            append_diagnostic(
                app.handle(),
                &format!("loaded config {}", config.config_path),
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            terminal_start,
            terminal_write,
            terminal_resize,
            terminal_log_start,
            terminal_log_stop,
            terminal_log_status,
            diagnostics_copy,
            diagnostics_path,
            diagnostics_log,
            config_get,
            config_apply_path,
            sync_status,
            sync_write_clipboard,
            sync_read_clipboard,
            sync_write_diagnostics,
            window_close,
            window_minimize,
            window_toggle_maximize,
            window_start_drag,
            window_save_bounds,
            window_get_bounds,
            window_set_bounds,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run fpasoterm");
}

// Normalizes direct binary arguments into the same environment overrides used by the Node launcher.
fn apply_direct_cli_env_overrides() {
    set_env_from_cli("FPASOTERM_CONFIG_PATH", &["--config", "-c"]);
    set_env_from_cli("FPASOTERM_SHELL", &["--shell", "-s"]);
    set_env_from_cli("FPASOTERM_WINDOW_TITLE", &["--title", "-t"]);
    set_env_from_cli("FPASOTERM_TITLEBAR_COLOR", &["--titlebar-color", "-b"]);
    set_env_from_cli("FPASOTERM_START_COMMAND", &["--command", "-e"]);
    if let Some((width, height)) = cli_size_option() {
        env::set_var("FPASOTERM_WINDOW_WIDTH", width.to_string());
        env::set_var("FPASOTERM_WINDOW_HEIGHT", height.to_string());
    }
    if env::var("FPASOTERM_WINDOW_TITLE").is_ok() {
        env::set_var("FPASOTERM_WINDOW_TITLE_LOCKED", "1");
    }
    if let Some(width) = cli_positive_u32_option_any(&["--width", "-W"]) {
        env::set_var("FPASOTERM_WINDOW_WIDTH", width.to_string());
    }
    if let Some(height) = cli_positive_u32_option_any(&["--height", "-H"]) {
        env::set_var("FPASOTERM_WINDOW_HEIGHT", height.to_string());
    }
    if cli_has_flag(&["--debug-keys", "-k"]) {
        env::set_var("FPASOTERM_DEBUG_KEYS", "1");
    }
    if cli_has_flag(&["--console-diagnostics", "-C"]) {
        env::set_var("FPASOTERM_CONSOLE_DIAGNOSTICS", "1");
    }
    if cli_has_flag(&["--debug-opaque-terminal"]) {
        env::set_var("FPASOTERM_DEBUG_OPAQUE_TERMINAL", "1");
    }
    if cli_has_flag(&["--disable-dmabuf"]) {
        env::set_var("FPASOTERM_DISABLE_DMABUF", "1");
    }
}

// Stores one sanitized CLI value in the process environment when present.
fn set_env_from_cli(name: &str, flags: &[&str]) {
    if let Some(value) = cli_option_value_any(flags) {
        env::set_var(name, sanitize_cli_value(&value));
    }
}

// Applies the runtime icon shown by Linux shelves, task switchers, and window managers.
fn set_window_icon(window: &tauri::WebviewWindow, icon: Option<&tauri::image::Image<'_>>) {
    if let Some(icon) = icon {
        if let Err(error) = window.set_icon(icon.clone()) {
            eprintln!("failed to set window icon: {error}");
        }
    }
}

// Re-applies startup size after the webview settles, then starts persisting user resizes.
fn schedule_startup_size_restore(
    app: AppHandle,
    window: tauri::WebviewWindow,
    state_path: String,
    remember: bool,
    size: PhysicalSize<u32>,
) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(650));
        let event_app = app.clone();
        let _ = app.run_on_main_thread(move || {
            let before = window.outer_size().ok();
            let _ = window.set_size(size);
            let after = window.outer_size().ok();
            append_diagnostic(
                &event_app,
                &format!(
                    "startup window size restore requested width={} height={} before={:?} after={:?}",
                    size.width, size.height, before, after
                ),
            );
            install_window_state_persistence(event_app, window, state_path, remember);
        });
    });
}

// Persists window size whenever Tauri reports a resize event.
fn install_window_state_persistence(
    app: AppHandle,
    window: tauri::WebviewWindow,
    state_path: String,
    remember: bool,
) {
    if !remember {
        return;
    }

    window.on_window_event(move |event| {
        if let WindowEvent::Resized(size) = event {
            if let Err(error) = save_window_size(*size, &state_path) {
                eprintln!("failed to save window size: {error}");
            } else {
                append_diagnostic(
                    &app,
                    &format!(
                        "saved window size width={} height={}",
                        size.width, size.height
                    ),
                );
            }
        }
    });
}

// Reads current native window size and writes it to the user state file.
fn save_window_state(window: &tauri::WebviewWindow, state_path: &str) -> Result<(), String> {
    let size = window.outer_size().map_err(|error| error.to_string())?;
    save_window_size(size, state_path)
}

// Stores only width and height so unsupported historical x/y state is ignored.
fn save_window_size(size: PhysicalSize<u32>, state_path: &str) -> Result<(), String> {
    let state = serde_json::json!({
        "window": {
            "width": size.width,
            "height": size.height
        }
    });
    if let Some(parent) = std::path::Path::new(state_path).parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(
        state_path,
        serde_json::to_string_pretty(&state).map_err(|error| error.to_string())? + "\n",
    )
    .map_err(|error| error.to_string())
}

// Returns the window state path from the resolved runtime config.
fn window_state_path() -> String {
    runtime_config().window_state_path
}

// Loads launcher-provided JSON config, falling back to direct binary parsing.
fn runtime_config() -> RuntimeConfig {
    let mut config = env::var("FPASOTERM_RUNTIME_CONFIG_JSON")
        .ok()
        .and_then(|value| serde_json::from_str(&value).ok())
        .unwrap_or_else(direct_runtime_config);
    apply_direct_cli_overrides(&mut config);
    config
}

// Builds direct-binary config by applying the user's TOML over built-in defaults.
fn direct_runtime_config() -> RuntimeConfig {
    let mut config = default_runtime_config();
    if fs::metadata(&config.config_path).is_ok() {
        let config_path = config.config_path.clone();
        config = merge_runtime_config_from_path(config, &config_path)
            .unwrap_or_else(|_| default_runtime_config());
    }
    apply_direct_cli_overrides(&mut config);
    config
}

// Loads a TOML config file on demand and merges it over the current runtime config.
fn runtime_config_from_path(config_path: &str) -> Result<RuntimeConfig, String> {
    merge_runtime_config_from_path(runtime_config(), config_path)
}

// Applies one TOML file to an existing runtime config.
fn merge_runtime_config_from_path(
    mut config: RuntimeConfig,
    config_path: &str,
) -> Result<RuntimeConfig, String> {
    let path = std::path::Path::new(config_path);
    let absolute_path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        env::current_dir()
            .map_err(|error| error.to_string())?
            .join(path)
    };
    let text = fs::read_to_string(&absolute_path).map_err(|error| error.to_string())?;
    let toml_value: toml::Value = toml::from_str(&text).map_err(|error| error.to_string())?;
    let override_value = serde_json::to_value(toml_value).map_err(|error| error.to_string())?;
    let mut config_value =
        serde_json::to_value(&config.config).map_err(|error| error.to_string())?;
    merge_json_value(&mut config_value, override_value);
    config.config = serde_json::from_value(config_value).map_err(|error| error.to_string())?;
    config.config_path = absolute_path.to_string_lossy().to_string();
    config.config_dir = absolute_path
        .parent()
        .map(|parent| parent.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string());
    config.window_state_path = format!("{}/window-state.json", config.config_dir);
    Ok(config)
}

// Recursively overlays object keys while replacing scalar and array values.
fn merge_json_value(base: &mut serde_json::Value, override_value: serde_json::Value) {
    match (base, override_value) {
        (serde_json::Value::Object(base_map), serde_json::Value::Object(override_map)) => {
            for (key, value) in override_map {
                match base_map.get_mut(&key) {
                    Some(base_value) => merge_json_value(base_value, value),
                    None => {
                        base_map.insert(key, value);
                    }
                }
            }
        }
        (base_value, value) => {
            *base_value = value;
        }
    }
}

// Builds a minimal config when the Tauri binary is started without the Node launcher.
fn default_runtime_config() -> RuntimeConfig {
    let home = home_dir();
    let config_dir = format!("{home}/.config/fpasoterm/User");
    let config_path = env::var("FPASOTERM_CONFIG_PATH")
        .ok()
        .or_else(|| cli_option_value_any(&["--config", "-c"]))
        .unwrap_or_else(|| format!("{config_dir}/config.toml"));
    let window_state_path = format!("{config_dir}/window-state.json");
    let mut window = WindowConfig {
        title: env::var("FPASOTERM_WINDOW_TITLE")
            .ok()
            .or_else(|| cli_option_value_any(&["--title", "-t"]))
            .or_else(|| read_configured_string(&config_path, "window", "title"))
            .unwrap_or_else(|| "fpasoterm".to_string()),
        width: 1000,
        height: 680,
        min_width: 420,
        min_height: 260,
        background_color: "rgba(0, 0, 0, 0)".to_string(),
        titlebar_color: env::var("FPASOTERM_TITLEBAR_COLOR")
            .ok()
            .or_else(|| cli_option_value_any(&["--titlebar-color", "-b"]))
            .or_else(|| read_configured_string(&config_path, "window", "titlebarColor"))
            .unwrap_or_else(|| "#1565c0".to_string()),
        title_locked: env::var("FPASOTERM_WINDOW_TITLE_LOCKED").as_deref() == Ok("1")
            || read_configured_bool(&config_path, "window", "titleLocked").unwrap_or(true),
        theme_source: "system".to_string(),
        frame: false,
        remember_bounds: true,
    };
    if let Some((width, height)) = read_saved_window_size(&window_state_path) {
        window.width = width;
        window.height = height;
    }
    if let Some((width, height)) = cli_size_option() {
        window.width = width;
        window.height = height;
    }
    if let Some(width) = cli_positive_u32_option_any(&["--width", "-W"]) {
        window.width = width;
    }
    if let Some(height) = cli_positive_u32_option_any(&["--height", "-H"]) {
        window.height = height;
    }

    RuntimeConfig {
        config: Config {
            window,
            terminal: serde_json::json!({
                "allowTransparency": true,
                "cursorBlink": true,
                "cursorStyle": "block",
                "fontFamily": "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Noto Sans Mono CJK JP\", monospace",
                "fontSize": 14,
                "scrollback": 1000,
                "shell": read_configured_shell(&config_path).unwrap_or_default(),
                "theme": {
                    "background": "rgba(16, 19, 23, 0.80)",
                    "foreground": "#e8edf2",
                    "cursor": "#f5d76e",
                    "selectionBackground": "#35506b"
                }
            }),
            ime: serde_json::json!({
                "duplicateGuard": true,
                "duplicateWindowMs": 800,
                "repeatedTextWindowMs": 140
            }),
            plugins: serde_json::json!({ "enabled": [] }),
            sync: serde_json::json!({
                "enabled": false,
                "provider": "folder",
                "path": "",
                "channel": "default",
                "clipboard": true,
                "diagnostics": true,
                "pasteRequiresConfirm": true,
                "maxBytes": 1048576,
                "ttlSeconds": 86400
            }),
            logging: serde_json::json!({
                "enabled": true,
                "directory": "",
                "autoStart": false,
                "maxBytes": 10485760
            }),
        },
        config_dir: config_dir.clone(),
        config_path,
        plugin_urls: Vec::new(),
        window_state_path,
        diagnostics: Some(DiagnosticsConfig {
            debug_keys: env::var("FPASOTERM_DEBUG_KEYS").as_deref() == Ok("1")
                || cli_has_flag(&["--debug-keys", "-k"]),
            console_diagnostics: env::var("FPASOTERM_CONSOLE_DIAGNOSTICS").as_deref() == Ok("1")
                || cli_has_flag(&["--console-diagnostics", "-C"]),
            opaque_terminal: Some(
                env::var("FPASOTERM_DEBUG_OPAQUE_TERMINAL").as_deref() == Ok("1")
                    || cli_has_flag(&["--debug-opaque-terminal"]),
            ),
        }),
    }
}

// Resolves the user's home directory on Unix-like systems and Windows.
fn home_dir() -> String {
    env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string())
}

// Reads a non-empty string from a specific TOML section and key.
fn read_configured_string(config_path: &str, section: &str, key: &str) -> Option<String> {
    let value: toml::Value = toml::from_str(&fs::read_to_string(config_path).ok()?).ok()?;
    value
        .get(section)?
        .get(key)?
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

// Reads a boolean from a specific TOML section and key.
fn read_configured_bool(config_path: &str, section: &str, key: &str) -> Option<bool> {
    let value: toml::Value = toml::from_str(&fs::read_to_string(config_path).ok()?).ok()?;
    value.get(section)?.get(key)?.as_bool()
}

// Reads terminal.shell from config.toml.
fn read_configured_shell(config_path: &str) -> Option<String> {
    read_configured_string(config_path, "terminal", "shell")
}

// Re-applies direct CLI overrides after config.toml and saved state are resolved.
fn apply_direct_cli_overrides(runtime: &mut RuntimeConfig) {
    if let Some(title) = cli_option_value_any(&["--title", "-t"]) {
        runtime.config.window.title = title;
        runtime.config.window.title_locked = true;
    }
    if let Some(color) = cli_option_value_any(&["--titlebar-color", "-b"]) {
        runtime.config.window.titlebar_color = color;
    }
    if let Some((width, height)) = cli_size_option() {
        runtime.config.window.width = width;
        runtime.config.window.height = height;
    }
    if let Some(width) = cli_positive_u32_option_any(&["--width", "-W"]) {
        runtime.config.window.width = width;
    }
    if let Some(height) = cli_positive_u32_option_any(&["--height", "-H"]) {
        runtime.config.window.height = height;
    }
    if let Some(shell) = cli_option_value_any(&["--shell", "-s"]) {
        if let Some(terminal) = runtime.config.terminal.as_object_mut() {
            terminal.insert("shell".to_string(), serde_json::Value::String(shell));
        }
    }
}

// Returns true when a direct binary argument includes any of the provided flags.
fn cli_has_flag(flags: &[&str]) -> bool {
    env::args()
        .skip(1)
        .any(|arg| flags.iter().any(|flag| arg == *flag))
}

// Returns the first value found for a set of equivalent long and short flags.
fn cli_option_value_any(flags: &[&str]) -> Option<String> {
    flags.iter().find_map(|flag| cli_option_value(flag))
}

// Parses both `--flag value` and `--flag=value` direct binary arguments.
fn cli_option_value(flag: &str) -> Option<String> {
    let equals_prefix = format!("{flag}=");
    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == flag {
            return args
                .next()
                .map(|value| sanitize_cli_value(&value))
                .filter(|value| !value.is_empty());
        }
        if let Some(value) = arg.strip_prefix(&equals_prefix) {
            let value = sanitize_cli_value(value);
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

// Removes accidental NUL terminators and surrounding whitespace from direct CLI values.
fn sanitize_cli_value(value: &str) -> String {
    value
        .trim_matches(|character: char| character.is_whitespace() || character == '\0')
        .replace('\0', "")
}

// Parses a positive integer option, ignoring invalid values so the UI can still start.
fn cli_positive_u32_option_any(flags: &[&str]) -> Option<u32> {
    cli_option_value_any(flags)
        .and_then(|value| value.parse::<u32>().ok().filter(|number| *number > 0))
}

// Resolves direct binary width/height overrides from --size.
fn cli_size_option() -> Option<(u32, u32)> {
    cli_option_value_any(&["--size", "-z"])
        .and_then(|value| {
            let (width, height) = value.split_once('x').or_else(|| value.split_once('X'))?;
            Some((
                width.trim().parse::<u32>().ok()?,
                height.trim().parse::<u32>().ok()?,
            ))
        })
        .filter(|(width, height)| *width > 0 && *height > 0)
}

// Writes CLI text for both console-subsystem and Windows GUI-subsystem builds.
fn print_cli_text(text: &str) {
    #[cfg(windows)]
    {
        print_cli_text_windows(text);
    }
    #[cfg(not(windows))]
    {
        print!("{text}");
    }
}

// Prints the resolved direct-binary config without opening the application window.
fn print_show_config() {
    match serde_json::to_string_pretty(&runtime_config()) {
        Ok(config) => print_cli_text(&(config + "\n")),
        Err(error) => {
            print_cli_error(&format!("fpasoterm: failed to serialize config: {error}\n"));
            std::process::exit(2);
        }
    }
}

// Deletes the remembered window state without opening the application window.
fn reset_window_state_cli() {
    let path = window_state_path();
    match fs::remove_file(&path) {
        Ok(()) => print_cli_text(&format!("deleted {path}\n")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            print_cli_text(&format!("no saved window state at {path}\n"));
        }
        Err(error) => {
            print_cli_error(&format!("fpasoterm: failed to delete {path}: {error}\n"));
            std::process::exit(2);
        }
    }
}

// Writes CLI errors through the same console-aware path used for normal output.
fn print_cli_error(text: &str) {
    print_cli_text(text);
}

#[cfg(windows)]
// Attaches to the parent console because release builds use windows_subsystem="windows".
fn print_cli_text_windows(text: &str) {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileA, WriteFile, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};

    const GENERIC_WRITE: u32 = 0x4000_0000;

    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
        let handle = CreateFileA(
            b"CONOUT$\0".as_ptr(),
            GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            null(),
            OPEN_EXISTING,
            0,
            null_mut(),
        );
        if handle != INVALID_HANDLE_VALUE {
            let mut written = 0;
            let _ = WriteFile(
                handle,
                text.as_ptr().cast(),
                text.len() as u32,
                &mut written,
                null_mut(),
            );
            CloseHandle(handle);
            return;
        }
    }

    print!("{text}");
}

// Reads saved window width and height, rejecting zero or out-of-range values.
fn read_saved_window_size(state_path: &str) -> Option<(u32, u32)> {
    let value: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(state_path).ok()?).ok()?;
    let window = value.get("window")?;
    let width = window.get("width")?.as_u64()?;
    let height = window.get("height")?.as_u64()?;
    if width == 0 || height == 0 || width > u32::MAX as u64 || height > u32::MAX as u64 {
        return None;
    }
    Some((width as u32, height as u32))
}

// Adds one diagnostic message to memory, optional stderr, and the renderer event stream.
fn append_diagnostic(app: &AppHandle, message: &str) {
    let line = format!("{} {}", chrono_like_timestamp(), message);
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut diagnostics) = state.diagnostics.lock() {
            diagnostics.push_back(line);
            while diagnostics.len() > 500 {
                diagnostics.pop_front();
            }
        }
    }
    if console_diagnostics_enabled() {
        eprintln!("{message}");
    }

    let _ = app.emit(
        "diagnostics:event",
        serde_json::json!({
            "source": "backend",
            "message": message,
        }),
    );
}

// Returns true when diagnostics should be mirrored to the parent console.
fn console_diagnostics_enabled() -> bool {
    env::var("FPASOTERM_CONSOLE_DIAGNOSTICS").as_deref() == Ok("1")
        || cli_has_flag(&["--console-diagnostics", "-C"])
}

// Produces a UTC timestamp without pulling in an additional Rust time crate.
fn chrono_like_timestamp() -> String {
    Command::new("date")
        .arg("-u")
        .arg("+%Y-%m-%dT%H:%M:%SZ")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

// Reads the configured macOS login shell from the local directory service.
fn macos_login_shell() -> Option<String> {
    let user = env::var("USER").ok()?;
    Command::new("dscl")
        .args([".", "-read", &format!("/Users/{user}"), "UserShell"])
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|value| value.split_whitespace().last().map(str::to_string))
        .filter(|value| value.starts_with('/'))
}

// Extracts a non-empty terminal.shell value from the resolved JSON config.
fn configured_shell(config: &Config) -> Option<String> {
    config
        .terminal
        .get("shell")
        .and_then(|value| value.as_str())
        .map(sanitize_shell_value)
        .filter(|value| !value.is_empty())
}

// Chooses the shell in environment, CLI, config, then platform-default order.
fn shell_command(config: &Config) -> String {
    if let Ok(shell) = env::var("FPASOTERM_SHELL") {
        if !shell.trim().is_empty() {
            return resolve_shell_command(&shell);
        }
    }
    if let Some(shell) = cli_option_value_any(&["--shell", "-s"]) {
        return resolve_shell_command(&shell);
    }
    if let Some(shell) = configured_shell(config) {
        return resolve_shell_command(&shell);
    }
    if cfg!(windows) {
        default_windows_shell()
    } else if cfg!(target_os = "macos") {
        macos_login_shell().unwrap_or_else(|| "/bin/zsh".to_string())
    } else {
        env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

#[cfg(windows)]
// Chooses PowerShell 7 by default when available, then falls back to the OS command shell.
fn default_windows_shell() -> String {
    for candidate in windows_pwsh_candidates() {
        if fs::metadata(&candidate).is_ok() {
            return candidate;
        }
    }
    env::var("ComSpec").unwrap_or_else(|_| "powershell.exe".to_string())
}

#[cfg(not(windows))]
fn default_windows_shell() -> String {
    String::new()
}

// Resolves known shell aliases that are not always available through PATH.
fn resolve_shell_command(shell: &str) -> String {
    let sanitized = sanitize_shell_value(shell);
    if cfg!(windows) {
        return resolve_windows_shell(&sanitized);
    }
    sanitized
}

// Removes accidental C-string terminators and surrounding whitespace from shell values.
fn sanitize_shell_value(shell: &str) -> String {
    shell
        .trim_matches(|character: char| character.is_whitespace() || character == '\0')
        .replace('\0', "")
}

// Finds PowerShell 7 when `pwsh.exe` is installed but not available on PATH.
#[cfg(windows)]
fn resolve_windows_shell(shell: &str) -> String {
    let trimmed = sanitize_shell_value(shell);
    if !trimmed.eq_ignore_ascii_case("pwsh") && !trimmed.eq_ignore_ascii_case("pwsh.exe") {
        return trimmed;
    }

    for candidate in windows_pwsh_candidates() {
        if fs::metadata(&candidate).is_ok() {
            return candidate;
        }
    }
    trimmed
}

#[cfg(not(windows))]
fn resolve_windows_shell(shell: &str) -> String {
    shell.to_string()
}

#[cfg(windows)]
// Builds common PowerShell 7 install paths from Windows environment variables.
fn windows_pwsh_candidates() -> Vec<String> {
    let mut candidates = Vec::new();
    if let Some(path_candidate) = windows_path_executable("pwsh.exe") {
        candidates.push(path_candidate);
    }
    if let Ok(program_files) = env::var("ProgramFiles") {
        candidates.push(format!("{program_files}\\PowerShell\\7\\pwsh.exe"));
    }
    if let Ok(program_files_x86) = env::var("ProgramFiles(x86)") {
        candidates.push(format!("{program_files_x86}\\PowerShell\\7\\pwsh.exe"));
    }
    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        candidates.push(format!(
            "{local_app_data}\\Microsoft\\powershell\\7\\pwsh.exe"
        ));
    }
    candidates
}

#[cfg(windows)]
// Resolves an executable through PATH before falling back to well-known install paths.
fn windows_path_executable(name: &str) -> Option<String> {
    let path = env::var_os("PATH")?;
    for directory in env::split_paths(&path) {
        let candidate = directory.join(name);
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

#[cfg(windows)]
// Prepends the installed executable directory so child shells can run `fpasoterm`.
fn terminal_path_with_app_dir() -> Option<String> {
    let app_dir = env::current_exe().ok()?.parent()?.to_path_buf();
    let existing_path = env::var_os("PATH").unwrap_or_default();
    let mut paths = vec![app_dir];
    paths.extend(env::split_paths(&existing_path));
    env::join_paths(paths)
        .ok()
        .map(|value| value.to_string_lossy().to_string())
}

#[cfg(not(windows))]
fn terminal_path_with_app_dir() -> Option<String> {
    None
}

#[tauri::command]
// Creates the PTY, starts the configured shell, and bridges output to the renderer.
fn terminal_start(
    app: AppHandle,
    state: State<AppState>,
    size: TerminalSize,
) -> Result<(), String> {
    let mut terminal = state.terminal.lock().map_err(|error| error.to_string())?;
    if terminal.is_some() {
        return Ok(());
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: size.rows.max(1),
            cols: size.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;

    let config = runtime_config();
    let shell = shell_command(&config.config);
    append_diagnostic(
        &app,
        &format!(
            "terminal_start shell={} cols={} rows={}",
            shell, size.cols, size.rows
        ),
    );
    let mut command = CommandBuilder::new(shell);
    if !cfg!(windows) {
        command.arg("-i");
    }
    command.cwd(home_dir());
    command.env("TERM", "xterm-256color");
    command.env("TERM_PROGRAM", "fpasoterm");
    if let Some(path_value) = terminal_path_with_app_dir() {
        command.env("Path", path_value);
    }

    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    let killer = Arc::new(Mutex::new(child.clone_killer()));
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let writer = Arc::new(Mutex::new(
        pair.master
            .take_writer()
            .map_err(|error| error.to_string())?,
    ));
    if logging_bool("autoStart", false) {
        match start_terminal_log_state(state.inner(), None) {
            Ok(status) => {
                append_diagnostic(&app, &format!("terminal log auto-started {}", status.path))
            }
            Err(error) => {
                append_diagnostic(&app, &format!("terminal log auto-start failed: {error}"))
            }
        }
    }
    let writer_for_state = Arc::clone(&writer);
    let terminal_log = Arc::clone(&state.terminal_log);
    let app_for_reader = app.clone();
    let app_for_wait = app.clone();

    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    if console_diagnostics_enabled() {
                        eprintln!("terminal_read bytes={read}");
                    }
                    append_terminal_log(&terminal_log, &buffer[..read]);
                    let data = String::from_utf8_lossy(&buffer[..read]).to_string();
                    let _ = app_for_reader.emit("terminal:data", data);
                }
                Err(error) => {
                    append_diagnostic(&app_for_reader, &format!("terminal read error: {error}"));
                    break;
                }
            }
        }
        append_diagnostic(&app_for_reader, "terminal reader ended");
    });

    std::thread::spawn(move || {
        let exit_code = match child.wait() {
            Ok(status) => Some(status.exit_code() as i32),
            Err(error) => {
                append_diagnostic(&app_for_wait, &format!("terminal wait error: {error}"));
                None
            }
        };
        let _ = app_for_wait.emit("terminal:exit", TerminalExit { exit_code });
        if let Some(window) = app_for_wait.get_webview_window("main") {
            let _ = window.close();
        }
    });

    let start_command = env::var("FPASOTERM_START_COMMAND")
        .ok()
        .or_else(|| cli_option_value_any(&["--command", "-e"]))
        .map(|command| command.trim().to_string())
        .filter(|command| !command.is_empty());
    if let Some(command) = start_command {
        if let Ok(mut writer) = writer.lock() {
            let _ = writeln!(writer, "{command}\r");
        }
    }

    *terminal = Some(TerminalSession {
        master: pair.master,
        writer: writer_for_state,
        killer,
    });
    Ok(())
}

#[tauri::command]
// Writes renderer keyboard/input data into the active PTY.
fn terminal_write(state: State<AppState>, data: String) -> Result<(), String> {
    let terminal = state.terminal.lock().map_err(|error| error.to_string())?;
    if let Some(session) = terminal.as_ref() {
        let mut writer = session.writer.lock().map_err(|error| error.to_string())?;
        if env::var("FPASOTERM_DEBUG_KEYS").as_deref() == Ok("1") {
            eprintln!("terminal_write bytes={}", data.len());
        }
        writer
            .write_all(data.as_bytes())
            .map_err(|error| error.to_string())?;
        writer.flush().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
// Resizes the active PTY to match the xterm.js grid.
fn terminal_resize(state: State<AppState>, size: TerminalSize) -> Result<(), String> {
    let terminal = state.terminal.lock().map_err(|error| error.to_string())?;
    if let Some(session) = terminal.as_ref() {
        if console_diagnostics_enabled() {
            eprintln!("terminal_resize cols={} rows={}", size.cols, size.rows);
        }
        session
            .master
            .resize(PtySize {
                rows: size.rows.max(1),
                cols: size.cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

// Returns the current logging section as a JSON object for tolerant access.
fn logging_config() -> serde_json::Map<String, serde_json::Value> {
    runtime_config()
        .config
        .logging
        .as_object()
        .cloned()
        .unwrap_or_default()
}

// Reads a boolean key from [logging], falling back to a default.
fn logging_bool(key: &str, default: bool) -> bool {
    logging_config()
        .get(key)
        .and_then(|value| value.as_bool())
        .unwrap_or(default)
}

// Reads a positive byte limit from [logging].
fn logging_max_bytes() -> u64 {
    logging_config()
        .get("maxBytes")
        .and_then(|value| value.as_u64())
        .filter(|value| *value > 0)
        .unwrap_or(10_485_760)
}

// Resolves the configured terminal log directory, defaulting to User/logs.
fn terminal_log_directory() -> PathBuf {
    let configured = logging_config()
        .get("directory")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(expand_sync_path);

    configured.unwrap_or_else(|| PathBuf::from(runtime_config().config_dir).join("logs"))
}

// Builds a timestamped default terminal output log path.
fn default_terminal_log_path() -> PathBuf {
    terminal_log_directory().join(format!("terminal-{}.log", now_millis()))
}

// Resolves an optional requested log path against the configured log directory.
fn resolve_terminal_log_path(path: Option<String>) -> PathBuf {
    match path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        Some(value) => {
            let path = expand_sync_path(&value);
            if path.is_absolute() {
                path
            } else {
                terminal_log_directory().join(path)
            }
        }
        None => default_terminal_log_path(),
    }
}

// Appends raw PTY output bytes to the active terminal log if logging is active.
fn append_terminal_log(log_state: &Arc<Mutex<Option<TerminalLog>>>, bytes: &[u8]) {
    let Ok(mut guard) = log_state.lock() else {
        return;
    };
    let Some(log) = guard.as_mut() else {
        return;
    };

    let max_bytes = log.max_bytes;
    if log.bytes_written >= max_bytes {
        return;
    }

    let remaining = (max_bytes - log.bytes_written) as usize;
    let write_len = bytes.len().min(remaining);
    if write_len == 0 {
        return;
    }

    if log.file.write_all(&bytes[..write_len]).is_ok() {
        log.bytes_written += write_len as u64;
        let _ = log.file.flush();
    }
}

#[tauri::command]
// Starts writing raw terminal output to a log file.
fn terminal_log_start(
    state: State<AppState>,
    request: Option<TerminalLogStartRequest>,
) -> Result<TerminalLogStatus, String> {
    start_terminal_log_state(state.inner(), request.and_then(|value| value.path))
}

// Opens a terminal output log file and stores it in shared application state.
fn start_terminal_log_state(
    state: &AppState,
    path_request: Option<String>,
) -> Result<TerminalLogStatus, String> {
    if !logging_bool("enabled", true) {
        return Err("terminal logging is disabled; set logging.enabled = true".to_string());
    }

    let path = resolve_terminal_log_path(path_request);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| error.to_string())?;
    let path_text = path.display().to_string();

    let mut guard = state
        .terminal_log
        .lock()
        .map_err(|error| error.to_string())?;
    *guard = Some(TerminalLog {
        path: path_text.clone(),
        file,
        bytes_written: 0,
        max_bytes: logging_max_bytes(),
    });
    Ok(TerminalLogStatus {
        enabled: true,
        active: true,
        path: path_text,
        bytes_written: 0,
        message: "terminal output logging started".to_string(),
    })
}

#[tauri::command]
// Stops the active terminal output log and returns the final path/counter.
fn terminal_log_stop(state: State<AppState>) -> Result<TerminalLogStatus, String> {
    let mut guard = state
        .terminal_log
        .lock()
        .map_err(|error| error.to_string())?;
    if let Some(mut log) = guard.take() {
        let _ = log.file.flush();
        return Ok(TerminalLogStatus {
            enabled: logging_bool("enabled", true),
            active: false,
            path: log.path,
            bytes_written: log.bytes_written,
            message: "terminal output logging stopped".to_string(),
        });
    }

    Ok(TerminalLogStatus {
        enabled: logging_bool("enabled", true),
        active: false,
        path: String::new(),
        bytes_written: 0,
        message: "terminal output logging was not active".to_string(),
    })
}

#[tauri::command]
// Returns the active terminal output log state.
fn terminal_log_status(state: State<AppState>) -> Result<TerminalLogStatus, String> {
    let guard = state
        .terminal_log
        .lock()
        .map_err(|error| error.to_string())?;
    if let Some(log) = guard.as_ref() {
        return Ok(TerminalLogStatus {
            enabled: logging_bool("enabled", true),
            active: true,
            path: log.path.clone(),
            bytes_written: log.bytes_written,
            message: "terminal output logging is active".to_string(),
        });
    }

    Ok(TerminalLogStatus {
        enabled: logging_bool("enabled", true),
        active: false,
        path: String::new(),
        bytes_written: 0,
        message: "terminal output logging is inactive".to_string(),
    })
}

#[tauri::command]
// Returns recent diagnostics as plain text for copying from the UI.
fn diagnostics_copy(state: State<AppState>) -> Result<String, String> {
    diagnostics_text(&state)
}

// Returns recent diagnostics from shared runtime state.
fn diagnostics_text(state: &AppState) -> Result<String, String> {
    let diagnostics = state
        .diagnostics
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(diagnostics.iter().cloned().collect::<Vec<_>>().join("\n"))
}

#[tauri::command]
// Keeps the renderer's diagnostics path display compatible with the old UI.
fn diagnostics_path() -> String {
    "diagnostics are kept in memory by the Tauri runtime".to_string()
}

#[tauri::command]
// Lets the renderer append messages to the backend diagnostics ring buffer.
fn diagnostics_log(app: AppHandle, message: String) {
    append_diagnostic(&app, &message);
}

#[tauri::command]
// Returns the resolved runtime config to the renderer.
fn config_get() -> RuntimeConfig {
    let config = runtime_config();
    if console_diagnostics_enabled() {
        eprintln!(
            "config_get title={} titlebarColor={} shell={}",
            config.config.window.title,
            config.config.window.titlebar_color,
            configured_shell(&config.config).unwrap_or_default()
        );
    }
    config
}

#[tauri::command]
// Loads and returns a config file requested by an in-terminal OSC command.
fn config_apply_path(app: AppHandle, path: String) -> Result<RuntimeConfig, String> {
    let config = runtime_config_from_path(&path)?;
    append_diagnostic(
        &app,
        &format!("applied runtime config {}", config.config_path),
    );
    Ok(config)
}

// Resolved sync-folder paths for the active channel.
struct SyncFolderPaths {
    provider: String,
    root: std::path::PathBuf,
    channel: String,
    clipboard: std::path::PathBuf,
    diagnostics: std::path::PathBuf,
}

// Returns the current sync section as a JSON object for tolerant access.
fn sync_config() -> serde_json::Map<String, serde_json::Value> {
    runtime_config()
        .config
        .sync
        .as_object()
        .cloned()
        .unwrap_or_default()
}

// Reads a string key from [sync], falling back to a default.
fn sync_string(key: &str, default: &str) -> String {
    sync_config()
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(default)
        .to_string()
}

// Reads a boolean key from [sync], falling back to a default.
fn sync_bool(key: &str, default: bool) -> bool {
    sync_config()
        .get(key)
        .and_then(|value| value.as_bool())
        .unwrap_or(default)
}

// Reads a positive byte limit from [sync].
fn sync_max_bytes() -> usize {
    sync_config()
        .get("maxBytes")
        .and_then(|value| value.as_u64())
        .filter(|value| *value > 0)
        .unwrap_or(1_048_576) as usize
}

// Reads the sync item lifetime in milliseconds; zero disables expiration.
fn sync_ttl_millis() -> u128 {
    sync_config()
        .get("ttlSeconds")
        .and_then(|value| value.as_u64())
        .map(|seconds| seconds as u128 * 1000)
        .unwrap_or(86_400_000)
}

// Normalizes channel names so they can safely be used as directory names.
fn sync_channel() -> String {
    let raw = sync_string("channel", "default");
    let sanitized = raw
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    sanitized
        .trim_matches('.')
        .trim_matches('_')
        .chars()
        .take(80)
        .collect::<String>()
}

// Expands %VAR% and $VAR references commonly used in config paths.
fn expand_path_variables(path: &str) -> String {
    let mut result = String::new();
    let chars: Vec<char> = path.chars().collect();
    let mut index = 0;

    while index < chars.len() {
        if chars[index] == '%' {
            if let Some(end) = chars[index + 1..]
                .iter()
                .position(|character| *character == '%')
            {
                let end_index = index + 1 + end;
                let name = chars[index + 1..end_index].iter().collect::<String>();
                if !name.is_empty() {
                    if let Ok(value) = env::var(&name) {
                        result.push_str(&value);
                    } else {
                        result.push('%');
                        result.push_str(&name);
                        result.push('%');
                    }
                    index = end_index + 1;
                    continue;
                }
            }
        }

        if chars[index] == '$' {
            let mut end_index = index + 1;
            while end_index < chars.len()
                && (chars[end_index].is_ascii_alphanumeric() || chars[end_index] == '_')
            {
                end_index += 1;
            }
            if end_index > index + 1 {
                let name = chars[index + 1..end_index].iter().collect::<String>();
                if let Ok(value) = env::var(&name) {
                    result.push_str(&value);
                } else {
                    result.push('$');
                    result.push_str(&name);
                }
                index = end_index;
                continue;
            }
        }

        result.push(chars[index]);
        index += 1;
    }

    result
}

// Expands a leading ~/ and environment variables so config files can be portable.
fn expand_sync_path(path: &str) -> std::path::PathBuf {
    let expanded = expand_path_variables(path.trim());
    if expanded == "~" {
        return std::path::PathBuf::from(home_dir());
    }
    if let Some(rest) = expanded
        .strip_prefix("~/")
        .or_else(|| expanded.strip_prefix("~\\"))
    {
        return std::path::PathBuf::from(home_dir()).join(rest);
    }
    std::path::PathBuf::from(expanded)
}

// Resolves and creates the sync channel directory for a specific operation.
fn sync_folder_paths(kind: &str) -> Result<SyncFolderPaths, String> {
    if !sync_bool("enabled", false) {
        return Err("sync folder is disabled; set sync.enabled = true".to_string());
    }

    let provider = sync_string("provider", "folder");
    if provider != "folder" {
        return Err(format!("unsupported sync provider: {provider}"));
    }

    if kind == "clipboard" && !sync_bool("clipboard", true) {
        return Err("sync clipboard is disabled; set sync.clipboard = true".to_string());
    }
    if kind == "diagnostics" && !sync_bool("diagnostics", true) {
        return Err("sync diagnostics is disabled; set sync.diagnostics = true".to_string());
    }

    let root_text = sync_string("path", "");
    if root_text.is_empty() {
        return Err("sync path is empty; set sync.path to a synced local folder".to_string());
    }

    let channel = {
        let value = sync_channel();
        if value.is_empty() {
            "default".to_string()
        } else {
            value
        }
    };
    let root = expand_sync_path(&root_text);
    let channel_dir = root.join(&channel);
    fs::create_dir_all(&channel_dir).map_err(|error| error.to_string())?;

    Ok(SyncFolderPaths {
        provider,
        root,
        channel,
        clipboard: channel_dir.join("clipboard.json"),
        diagnostics: channel_dir.join("diagnostics.json"),
    })
}

// Selects the only supported sync item file names.
fn sync_item_path(kind: &str) -> Result<std::path::PathBuf, String> {
    let paths = sync_folder_paths(kind)?;
    match kind {
        "clipboard" => Ok(paths.clipboard),
        "diagnostics" => Ok(paths.diagnostics),
        _ => Err(format!("unsupported sync item kind: {kind}")),
    }
}

// Returns the current UNIX timestamp in milliseconds.
fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

// Writes a sync item through a temporary file and atomic rename.
fn write_sync_item(kind: &str, text: String, source_id: &str) -> Result<SyncItem, String> {
    let max_bytes = sync_max_bytes();
    if text.len() > max_bytes {
        return Err(format!(
            "sync {kind} payload is too large: {} bytes > {max_bytes} bytes",
            text.len()
        ));
    }

    let paths = sync_folder_paths(kind)?;
    let path = sync_item_path(kind)?;
    let item = SyncItem {
        schema_version: 1,
        kind: kind.to_string(),
        channel: paths.channel,
        source_id: source_id.to_string(),
        updated_at: now_millis(),
        text,
    };
    let json = serde_json::to_string_pretty(&item).map_err(|error| error.to_string())?;
    let temp_path = path.with_extension(format!("json.tmp.{}", source_id.replace('/', "_")));
    fs::write(&temp_path, format!("{json}\n")).map_err(|error| error.to_string())?;
    fs::rename(&temp_path, &path).map_err(|error| error.to_string())?;
    Ok(item)
}

// Reads a sync item if the configured file exists.
fn read_sync_item(kind: &str) -> Result<Option<SyncItem>, String> {
    let path = sync_item_path(kind)?;
    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let item: SyncItem = serde_json::from_str(&text).map_err(|error| error.to_string())?;
    let ttl_millis = sync_ttl_millis();
    if ttl_millis > 0 && now_millis().saturating_sub(item.updated_at) > ttl_millis {
        return Ok(None);
    }
    Ok(Some(item))
}

#[tauri::command]
// Returns where sync-folder files would be read and written.
fn sync_status() -> SyncStatus {
    match sync_folder_paths("status") {
        Ok(paths) => SyncStatus {
            enabled: true,
            provider: paths.provider,
            path: paths.root.display().to_string(),
            channel: paths.channel,
            clipboard_path: paths.clipboard.display().to_string(),
            diagnostics_path: paths.diagnostics.display().to_string(),
            message: "sync folder is enabled".to_string(),
        },
        Err(message) => SyncStatus {
            enabled: false,
            provider: sync_string("provider", "folder"),
            path: sync_string("path", ""),
            channel: sync_channel(),
            clipboard_path: String::new(),
            diagnostics_path: String::new(),
            message,
        },
    }
}

#[tauri::command]
// Publishes explicit clipboard text to the configured sync folder.
fn sync_write_clipboard(
    state: State<AppState>,
    request: SyncWriteRequest,
) -> Result<SyncItem, String> {
    write_sync_item("clipboard", request.text, &state.source_id)
}

#[tauri::command]
// Reads the latest clipboard text from the configured sync folder.
fn sync_read_clipboard() -> Result<Option<SyncItem>, String> {
    read_sync_item("clipboard")
}

#[tauri::command]
// Publishes recent diagnostics to the configured sync folder.
fn sync_write_diagnostics(state: State<AppState>) -> Result<SyncItem, String> {
    let text = diagnostics_text(&state)?;
    write_sync_item("diagnostics", text, &state.source_id)
}

#[tauri::command]
// Closes the main application window.
fn window_close(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

#[tauri::command]
// Minimizes the main application window from the custom titlebar.
fn window_minimize(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
// Toggles the main window between maximized and restored states.
fn window_toggle_maximize(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command]
// Starts native dragging from the custom titlebar.
fn window_start_drag(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
// Explicitly saves current window size when requested by the renderer.
fn window_save_bounds(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    save_window_state(&window, &window_state_path())
}

#[tauri::command]
// Returns current native window bounds to the renderer.
fn window_get_bounds(app: AppHandle) -> Result<WindowBounds, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    Ok(WindowBounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}

#[tauri::command]
// Applies renderer-requested size or position changes to the native window.
fn window_set_bounds(app: AppHandle, bounds: WindowBoundsRequest) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    if let (Some(width), Some(height)) = (bounds.width, bounds.height) {
        window
            .set_size(PhysicalSize::new(width, height))
            .map_err(|error| error.to_string())?;
    }
    if let (Some(x), Some(y)) = (bounds.x, bounds.y) {
        window
            .set_position(PhysicalPosition::new(x, y))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

impl Drop for TerminalSession {
    // Terminates the child shell when the session is dropped.
    fn drop(&mut self) {
        if let Ok(mut killer) = self.killer.lock() {
            let _ = killer.kill();
        }
    }
}
