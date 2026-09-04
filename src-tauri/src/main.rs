#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]

#[cfg(windows)]
use base64::Engine;
use encoding_rs::{EUC_JP, SHIFT_JIS};
use hmac::{Hmac, Mac};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::{HashSet, VecDeque};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
#[cfg(target_os = "macos")]
use std::process::Child;
#[cfg(not(target_os = "windows"))]
use std::process::Output;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
#[cfg(target_os = "windows")]
use std::{ptr, slice};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow, WindowEvent,
};
#[cfg(not(target_os = "windows"))]
use tauri::{WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{CloseHandle, GlobalFree, INVALID_HANDLE_VALUE};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
    SetClipboardData,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Memory::{
    GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Threading::{
    GetExitCodeProcess, OpenProcess, TerminateProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    PROCESS_TERMINATE,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Shell::ShellExecuteW;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    MessageBoxW, IDOK, MB_ICONWARNING, MB_OKCANCEL, MB_SETFOREGROUND, MB_TASKMODAL, MB_TOPMOST,
};

#[cfg(target_os = "windows")]
const WINDOWS_CF_UNICODETEXT: u32 = 13;

const INSTANCE_HEARTBEAT_INTERVAL: Duration = Duration::from_millis(500);
const INSTANCE_HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
// Complete runtime configuration shared with the renderer.
struct RuntimeConfig {
    config: Config,
    config_dir: String,
    config_path: String,
    plugin_urls: Vec<PluginUrl>,
    window_state_path: String,
    #[serde(default)]
    active_profile: String,
    diagnostics: Option<DiagnosticsConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
// User-facing configuration grouped by the TOML sections.
struct Config {
    window: WindowConfig,
    terminal: serde_json::Value,
    ime: serde_json::Value,
    keybindings: serde_json::Value,
    plugins: serde_json::Value,
    sync: serde_json::Value,
    logging: serde_json::Value,
    security: serde_json::Value,
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
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// Current xterm.js grid and rendered pixel size reported by the renderer.
struct TerminalSize {
    cols: u16,
    rows: u16,
    // Older renderers only send rows and cols, so retain a safe zero default.
    #[serde(default)]
    pixel_width: u16,
    #[serde(default)]
    pixel_height: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// One SSHFS mount request. Password values are never persisted or logged.
struct SshfsMountRequest {
    host: String,
    user: String,
    port: u16,
    remote_path: String,
    mount_name: String,
    identity_file: Option<String>,
    password: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// A mount result that can be safely shown in the management window.
struct SshfsMountResult {
    mount_point: String,
    message: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
// Persistent, non-secret description of one FpasoTerm-managed mount.
struct SshfsMountRecord {
    host: String,
    user: String,
    port: u16,
    remote_path: String,
    mount_name: String,
    identity_file: Option<String>,
    // Windows SSHFS-Win mounts network drives rather than User/mounts paths.
    // Keep the assigned drive so a later Unmount addresses the same resource.
    #[serde(default)]
    mount_point: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Safe manager state shown in the renderer; credentials are deliberately absent.
struct SshfsStatus {
    mount_root: String,
    available: bool,
    program_path: String,
    mounts: Vec<SshfsMountRecord>,
    active_mount_names: Vec<String>,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// One native window placement delivered to a running fpasoterm process.
struct ArrangeWindowBounds {
    pid: u32,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
// A live window together with the stable display-title ordering used by Tile.
struct ArrangeInstance {
    pid: u32,
    base_title: String,
    display_title: String,
    instance_number: usize,
    created_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// A short-lived broadcast that asks every instance to tile its window.
struct ArrangeRequest {
    created_at: u128,
    windows: Vec<ArrangeWindowBounds>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// Renderer-reported available screen area, including ChromeOS shelf/scaling.
struct ArrangeScreen {
    width: f64,
    height: f64,
    left: f64,
    top: f64,
    device_pixel_ratio: f64,
}

// Keeps a lightweight marker for this process so new windows can avoid stacking
// exactly on top of already running windows.
struct InstanceMarker {
    path: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Current sync-folder state returned to the renderer.
struct SyncStatus {
    enabled: bool,
    provider: String,
    path: String,
    channel: String,
    diagnostics_path: String,
    commands_path: String,
    health: String,
    root_exists: bool,
    root_readable: bool,
    root_writable: bool,
    diagnostics_exists: bool,
    diagnostics_bytes: u64,
    diagnostics_updated_at: u128,
    active_commands: usize,
    stale_commands: usize,
    invalid_commands: usize,
    temporary_files: usize,
    channels: Vec<SyncChannelStatus>,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// One discovered sync channel and its short-lived command-file state.
struct SyncChannelStatus {
    name: String,
    diagnostics_exists: bool,
    active_commands: usize,
    stale_commands: usize,
    invalid_commands: usize,
    temporary_files: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Summary returned after deleting only expired or abandoned sync command files.
struct SyncCleanupResult {
    path: String,
    channel: String,
    removed_expired_commands: usize,
    removed_invalid_commands: usize,
    removed_temporary_files: usize,
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

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
// One short-lived PTY input request shared by local or synced fpasoterm instances.
struct TerminalBroadcastItem {
    schema_version: u8,
    id: String,
    source_id: String,
    created_at: u128,
    expires_at: u128,
    text: String,
    target_instance_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    key_event: Option<TerminalBroadcastKeyEvent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    signature: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
// Canonical signed fields shared with the Node launcher implementation.
struct TerminalBroadcastSignaturePayload<'a> {
    schema_version: u8,
    id: &'a str,
    source_id: &'a str,
    created_at: u128,
    expires_at: u128,
    text: &'a str,
    target_instance_ids: &'a [String],
    #[serde(skip_serializing_if = "Option::is_none")]
    key_event: Option<&'a TerminalBroadcastKeyEvent>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
// A semantic terminal key delivered by the target renderer's active xterm encoder.
struct TerminalBroadcastKeyEvent {
    key: String,
    code: String,
    shift_key: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// Renderer request to send input to all local windows and optionally a sync channel.
struct TerminalBroadcastRequest {
    text: String,
    include_sync: bool,
    target_instance_ids: Vec<String>,
    key_event: Option<TerminalBroadcastKeyEvent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// One live local terminal that can be selected by the broadcast dialog.
struct TerminalBroadcastTarget {
    id: String,
    pid: u32,
    title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Result returned after one broadcast file is safely published.
struct TerminalBroadcastStatus {
    id: String,
    include_sync: bool,
    message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// Optional terminal log start request from the renderer.
struct TerminalLogStartRequest {
    path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
// Optional terminal log path request from the renderer.
struct TerminalLogPathRequest {
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Tail preview of the active or most recent terminal output log.
struct TerminalLogPreview {
    path: String,
    text: String,
    bytes: u64,
    truncated: bool,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// A selectable terminal output log file entry for the renderer.
struct TerminalLogItem {
    path: String,
    name: String,
    bytes: u64,
    active: bool,
    modified_at: u128,
}

// Active terminal output log file and byte counter.
struct TerminalLog {
    path: String,
    file: File,
    bytes_written: u64,
    max_bytes: u64,
    decoder: TerminalOutputDecoder,
    normalizer: TerminalTextNormalizer,
}

#[derive(Debug, PartialEq, Eq)]
enum TerminalLogCleanup {
    Deleted,
    Cleared,
}

// Owns the native PTY session and child shell handles.
struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
    shell_pid: Option<u32>,
}

// Decodes PTY bytes before they are sent to xterm.js.
struct TerminalOutputDecoder {
    pending: Vec<u8>,
    jis_x0201_kana: bool,
    legacy_decoder: Option<encoding_rs::Decoder>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
// Selects the byte decoder used for PTY output. UTF-8 remains the default.
enum TerminalEncoding {
    Utf8,
    ShiftJis,
    EucJp,
}

// Converts terminal control output to readable append-only text.
struct TerminalTextNormalizer {
    pending: String,
    row: usize,
    column: usize,
}

// Shared runtime state for the active PTY session and recent diagnostics.
struct AppState {
    terminal: Arc<Mutex<Option<TerminalSession>>>,
    diagnostics: Arc<Mutex<VecDeque<String>>>,
    terminal_log: Arc<Mutex<Option<TerminalLog>>>,
    last_terminal_log_path: Arc<Mutex<Option<String>>>,
    source_id: String,
    started_at: u128,
    broadcast_listener_started: AtomicBool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            terminal: Arc::new(Mutex::new(None)),
            diagnostics: Arc::new(Mutex::new(VecDeque::new())),
            terminal_log: Arc::new(Mutex::new(None)),
            last_terminal_log_path: Arc::new(Mutex::new(None)),
            source_id: format!("{}-{}", std::process::id(), now_millis()),
            started_at: now_millis(),
            broadcast_listener_started: AtomicBool::new(false),
        }
    }
}

impl Drop for InstanceMarker {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

const HELP_TEXT: &str = "Usage: fpasoterm [options]\n\nOptions:\n  -h, --help                    Show this help.\n  -v, --version                 Show the version and build commit.\n      --update-check             Compare the installed version with npm latest, then exit.\n      --plugin-search [query]   Search official public plugin ports, then exit.\n      --doctor                   Check updates and configuration health, then exit.\n      --completion <shell>      Print a completion script: bash, zsh, fish, or powershell.\n      --completion-install <shell>\n                                Install persistent command completion for a shell.\n      --completion-uninstall <shell>\n                                Remove fpasoterm's persistent command completion.\n  -l, --list                    List running fpasoterm windows, then exit.\n  -q, --close <pid|title|all>   Close windows by PID, exact title, or all.\n      --broadcast <text>        Send text plus Enter to running local terminal windows.\n      --broadcast-target <pid|title>\n                                Limit Broadcast targets (comma-separated/repeatable).\n      --broadcast-sync          Also send Broadcast through the trusted sync channel.\n  -d, --dev                     Force a local debug-binary rebuild when using the Node launcher.\n  -F, --foreground              Keep the launcher attached to the current console.\n  -C, --console-diagnostics     Print diagnostics to stderr as well as the log file.\n  -c, --config <path>           Use a specific config.toml for this launch.\n  -p, --profile <name>          Apply a named [profiles.<name>] overlay for this launch.\n      --profile-list            List available named profiles, then exit.\n      --plugin-list             List local User/plugins files and enabled plugins, then exit.\n      --plugin-path             Print the active User/plugins directory, then exit.\n      --plugin-info <file>      Show a .js/.ts plugin's state, version, and source details.\n      --plugin-uninstall <file> Remove comma-separated local plugin files, then exit.\n      --plugin-install <port>   Install from GitHub, or --plugin-ports-dir when supplied.\n      --plugin-ports-dir <path> Use this local fpasoterm-plugins checkout.\n      --plugin-install-file <path>\n                                Copy one trusted local .js/.ts plugin into User/plugins.\n      --force                   Replace an existing file during a plugin install.\n      --enable                  Enable a plugin installed by one --plugin-install command.\n      --enable-plugin <names>   Enable comma-separated/repeatable plugin names, then exit.\n      --disable-plugin <names>  Disable comma-separated/repeatable plugin names, then exit.\n      --plugin-enable-all       Enable every discovered User/plugins .js/.ts file, then exit.\n      --plugin-disable-all      Disable every plugin without deleting plugin files, then exit.\n      --plugin-enable <names>   Alias for --enable-plugin.\n      --plugin-disable <names>  Alias for --disable-plugin.\n      --show-config             Print resolved settings and plugin load status, then exit.\n      --config-check             Validate config.toml and report warnings, then exit.\n      --config-path              Print the active config.toml path, then exit.\n      --config-example           Print the active config.toml.example contents, then exit.\n      --diagnostics              Print a Markdown diagnostics report, then exit.\n      --open-log-dir             Open the configured terminal log directory, then exit.\n      --copy-diagnostics         Copy the Markdown diagnostics report to the clipboard, then exit.\n      --update-config           Add missing default settings and back up config.toml, then exit.\n      --prune-config            Remove unsupported settings and back up config.toml, then exit.\n      --sync-status              Report folder health, commands, and discovered channels.\n      --sync-clean               Remove expired or abandoned command files.\n      --sync-diagnostics         Print the Markdown sync health report.\n  -s, --shell <command>         Override the configured shell for this launch.\n  -o, --cwd <path>              Start the terminal in this directory. Relative paths are allowed.\n  -e, --command <command>       Send a command to the shell after launch.\n  -t, --title <text>            Override the titlebar title for this launch.\n  -b, --titlebar-color <color>  Override the custom titlebar color for this launch.\n  -r, --reset-window-state      Delete saved window size, then exit.\n  -R, --reset-config            Rename config.toml, restore defaults and default size, then exit.\n  -W, --width <px>              Override the configured window width for this launch.\n  -H, --height <px>             Override the configured window height for this launch.\n  -z, --size <width>x<height>   Override both window dimensions for this launch.\n  -k, --debug-keys              Enable key/composition diagnostics.\n      --disable-dmabuf          Set WEBKIT_DISABLE_DMABUF_RENDERER=1 for Linux WebKitGTK diagnostics.\n\nExamples:\n  fpasoterm --cwd .\n  fpasoterm --cwd ~/work/project --title project\n  fpasoterm --broadcast \"git status\" --broadcast-target project\n\nCompletion:\n  fpasoterm --completion-install bash\n  fpasoterm --completion-uninstall bash\n\nProfiles:\n  [profiles.large-font.terminal]\n  fontSize = 18\n  fpasoterm --profile large-font\n";

const COMPLETION_BASH: &str = include_str!("../../completions/fpasoterm.bash");
const COMPLETION_ZSH: &str = include_str!("../../completions/_fpasoterm");
const COMPLETION_FISH: &str = include_str!("../../completions/fpasoterm.fish");
const COMPLETION_POWERSHELL: &str = include_str!("../../completions/fpasoterm.ps1");

// The direct binary has the same core options as the Node launcher.
fn cli_help_text() -> String {
    HELP_TEXT.to_string()
}

// Starts Tauri and registers window setup plus renderer-callable commands.
fn main() {
    if let Err(error) = validate_direct_cli_args(&env::args().skip(1).collect::<Vec<_>>()) {
        print_cli_error(&format!("fpasoterm: {error}\n"));
        std::process::exit(2);
    }

    apply_direct_cli_env_overrides();

    if cli_has_flag(&["--help", "-h"]) {
        print_cli_text(&cli_help_text());
        return;
    }
    if cli_has_flag(&["--version", "-v"]) {
        print_cli_text(&format!("fpasoterm {}\n", app_version()));
        return;
    }
    if cli_has_flag(&["--update-check"]) {
        match npm_update_check() {
            Ok(status) => print_cli_text(&npm_update_check_text(&status)),
            Err(error) => {
                print_cli_error(&format!("fpasoterm: {error}\n"));
                std::process::exit(1);
            }
        }
        return;
    }
    if cli_has_flag(&["--doctor"]) {
        doctor_cli();
        return;
    }
    if cli_has_flag(&["--plugin-search"]) {
        match public_plugin_search_text(&cli_optional_value("--plugin-search")) {
            Ok(text) => print_cli_text(&text),
            Err(error) => {
                print_cli_error(&format!("fpasoterm: {error}\n"));
                std::process::exit(1);
            }
        }
        return;
    }
    if let Some(shell) = cli_option_value("--completion") {
        print_completion_cli(&shell);
        return;
    }
    if let Some(shell) = cli_option_value("--completion-install") {
        if let Err(error) = install_completion_cli(&shell) {
            print_cli_error(&format!("fpasoterm: {error}\n"));
            std::process::exit(1);
        }
        return;
    }
    if let Some(shell) = cli_option_value("--completion-uninstall") {
        if let Err(error) = uninstall_completion_cli(&shell) {
            print_cli_error(&format!("fpasoterm: {error}\n"));
            std::process::exit(1);
        }
        return;
    }
    if cli_has_flag(&["--list", "-l"]) {
        print_running_instances();
        return;
    }
    if let Some(target) = cli_option_value_any(&["--close", "-q"]) {
        match broadcast_targeted_close_request(&sanitize_cli_value(&target)) {
            Ok(lines) => print_cli_text(&lines),
            Err(error) => {
                print_cli_error(&format!("fpasoterm: {error}"));
                std::process::exit(1);
            }
        }
        return;
    }
    if cli_option_value("--broadcast").is_some() {
        match broadcast_terminal_input_cli() {
            Ok(message) => print_cli_text(&message),
            Err(error) => {
                print_cli_error(&format!("fpasoterm: {error}\n"));
                std::process::exit(1);
            }
        }
        return;
    }
    if cli_has_flag(&["--show-config"]) {
        print_show_config();
        return;
    }
    if cli_has_flag(&["--profile-list"]) {
        print_profile_list_cli();
        return;
    }
    if let Err(error) = validate_selected_profile_cli() {
        print_cli_error(&format!("fpasoterm: {error}\n"));
        std::process::exit(2);
    }
    if cli_has_flag(&["--config-check"]) {
        config_check_cli();
        return;
    }
    if cli_has_flag(&["--config-path"]) {
        print_cli_text(&format!("{}\n", default_runtime_config().config_path));
        return;
    }
    if cli_has_flag(&["--sync-status", "--sync-clean", "--sync-diagnostics"]) {
        sync_cli();
        return;
    }
    if plugin_cli_requested() {
        plugin_cli();
        return;
    }
    if cli_has_flag(&["--config-example"]) {
        print_cli_text(&embedded_default_config_toml());
        return;
    }
    if cli_has_flag(&["--diagnostics"]) {
        print_cli_text(&diagnostics_markdown_cli());
        return;
    }
    if cli_has_flag(&["--copy-diagnostics"]) {
        match clipboard_write(diagnostics_markdown_cli()) {
            Ok(()) => print_cli_text("copied diagnostics to clipboard\n"),
            Err(error) => {
                print_cli_error(&format!("fpasoterm: could not copy diagnostics: {error}\n"));
                std::process::exit(2);
            }
        }
        return;
    }
    if cli_has_flag(&["--open-log-dir"]) {
        open_log_directory_cli();
        return;
    }
    if cli_has_flag(&["--reset-window-state", "-r"]) {
        reset_window_state_cli();
        return;
    }
    if cli_has_flag(&["--reset-config", "-R"]) {
        reset_config_cli();
        return;
    }
    if cli_has_flag(&["--update-config"]) {
        update_config_cli();
        return;
    }
    if cli_has_flag(&["--prune-config"]) {
        prune_config_cli();
        return;
    }
    if detach_nested_macos_launch() {
        return;
    }

    if env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err()
        && (env::var("FPASOTERM_DISABLE_DMABUF").as_deref() == Ok("1")
            || cli_has_flag(&["--disable-dmabuf"]))
    {
        env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .setup(|app| {
            let mut config = runtime_config();
            refresh_config_example(&config.config_path);
            let instance_index = claim_instance_index(app.handle(), &config.config.window.title);
            apply_instance_identity(&mut config, instance_index);
            publish_runtime_config(&config);
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
                set_fpasoterm_window_icon(app.handle(), &window);
                let _ = window.set_size(restore_size);
                append_diagnostic(
                    app.handle(),
                    &format!(
                        "restoring window size width={} height={}",
                        config.config.window.width, config.config.window.height
                    ),
                );
                let _ = window.set_min_size(Some(PhysicalSize::new(
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
                start_arrange_listener(
                    app.handle().clone(),
                    cache_dir_path()
                        .join("instances")
                        .join(format!("{}.pid", std::process::id())),
                    config.config.window.min_width,
                    config.config.window.min_height,
                );
                let focus_app = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(120));
                    let app_for_main = focus_app.clone();
                    let _ = focus_app.run_on_main_thread(move || {
                        if let Some(window) = app_for_main.get_webview_window("main") {
                            let _ = window.set_focus();
                        }
                    });
                });
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
            terminal_kill,
            terminal_broadcast,
            terminal_broadcast_targets,
            terminal_resize,
            terminal_log_start,
            terminal_log_stop,
            terminal_log_status,
            terminal_log_show,
            terminal_log_clear,
            terminal_log_list,
            terminal_log_delete,
            diagnostics_copy,
            diagnostics_path,
            diagnostics_log,
            clipboard_read,
            clipboard_write,
            open_external_url,
            app_version,
            update_check,
            plugin_catalog,
            terminal_capabilities,
            config_get,
            config_apply_path,
            config_set_terminal_encoding,
            sync_status,
            sync_clean,
            sync_write_diagnostics,
            window_close,
            window_minimize,
            window_toggle_maximize,
            window_start_drag,
            window_arrange,
            window_close_all,
            window_new,
            window_new_at_cwd,
            sshfs_mount,
            sshfs_unmount,
            sshfs_unmount_all,
            sshfs_forget,
            sshfs_status,
            window_confirm_close_all,
            window_close_all_confirmed,
            window_focus_main,
            window_cancel_close_all,
            window_save_bounds,
            window_get_bounds,
            window_set_bounds,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run fpasoterm");
}

// Validates direct binary arguments before Tauri creates an application window.
fn validate_direct_cli_args(args: &[String]) -> Result<(), String> {
    const FLAGS: &[&str] = &[
        "--help",
        "-h",
        "--version",
        "-v",
        "--update-check",
        "--doctor",
        "--plugin-search",
        "--list",
        "-l",
        "--foreground",
        "-F",
        "--console-diagnostics",
        "-C",
        "--show-config",
        "--profile-list",
        "--plugin-list",
        "--plugin-path",
        "--plugin-enable-all",
        "--plugin-disable-all",
        "--force",
        "--enable",
        "--sync-status",
        "--sync-clean",
        "--sync-diagnostics",
        "--broadcast-sync",
        "--config-check",
        "--config-path",
        "--config-example",
        "--diagnostics",
        "--open-log-dir",
        "--copy-diagnostics",
        "--reset-window-state",
        "-r",
        "--reset-config",
        "-R",
        "--update-config",
        "--prune-config",
        "--debug-keys",
        "-k",
        "--disable-dmabuf",
    ];
    const VALUE_OPTIONS: &[&str] = &[
        "--config",
        "-c",
        "--profile",
        "-p",
        "--plugin-info",
        "--plugin-uninstall",
        "--enable-plugin",
        "--disable-plugin",
        "--plugin-enable",
        "--plugin-disable",
        "--plugin-install",
        "--plugin-ports-dir",
        "--plugin-install-file",
        "--shell",
        "-s",
        "--cwd",
        "-o",
        "--command",
        "-e",
        "--title",
        "-t",
        "--titlebar-color",
        "-b",
        "--close",
        "-q",
        "--width",
        "-W",
        "--height",
        "-H",
        "--size",
        "-z",
        "--broadcast",
        "--broadcast-target",
        "--completion",
        "--completion-install",
        "--completion-uninstall",
    ];

    let mut index = 0;
    while index < args.len() {
        let argument = &args[index];
        if FLAGS.contains(&argument.as_str())
            || cfg!(target_os = "macos") && argument.starts_with("-psn_")
        {
            index += if argument == "--plugin-search"
                && args
                    .get(index + 1)
                    .is_some_and(|value| !value.starts_with('-'))
            {
                2
            } else {
                1
            };
            continue;
        }

        let equals_option = VALUE_OPTIONS.iter().find_map(|option| {
            argument
                .strip_prefix(&format!("{option}="))
                .map(|value| (*option, value))
        });
        if let Some((option, value)) = equals_option {
            validate_direct_cli_value(option, value)?;
            index += 1;
            continue;
        }

        if VALUE_OPTIONS.contains(&argument.as_str()) {
            let value = args
                .get(index + 1)
                .filter(|value| !value.starts_with('-'))
                .ok_or_else(|| {
                    if matches!(
                        argument.as_str(),
                        "--completion" | "--completion-install" | "--completion-uninstall"
                    ) {
                        format!(
                            "{argument} requires a shell: bash, zsh, fish, or powershell (example: fpasoterm {argument} bash)"
                        )
                    } else {
                        format!("{argument} requires a value")
                    }
                })?;
            validate_direct_cli_value(argument, value)?;
            index += 2;
            continue;
        }

        return Err(if argument.starts_with('-') {
            format!("unknown option: {argument}")
        } else {
            format!("unexpected argument: {argument}")
        });
    }
    let has_broadcast = args
        .iter()
        .any(|argument| argument == "--broadcast" || argument.starts_with("--broadcast="));
    let has_broadcast_option = args.iter().any(|argument| {
        argument == "--broadcast-target"
            || argument.starts_with("--broadcast-target=")
            || argument == "--broadcast-sync"
    });
    if has_broadcast_option && !has_broadcast {
        return Err(
            "--broadcast-target and --broadcast-sync require --broadcast <text>".to_string(),
        );
    }
    let plugin_install_count = args
        .iter()
        .filter(|argument| {
            matches!(
                argument.as_str(),
                "--plugin-install" | "--plugin-install-file"
            ) || argument.starts_with("--plugin-install=")
                || argument.starts_with("--plugin-install-file=")
        })
        .count();
    if plugin_install_count > 1 {
        return Err("use only one of --plugin-install or --plugin-install-file".to_string());
    }
    if plugin_install_count == 0
        && args
            .iter()
            .any(|argument| argument == "--force" || argument == "--enable")
    {
        return Err("--force and --enable require a --plugin-install command".to_string());
    }
    if args.iter().any(|argument| {
        argument == "--plugin-ports-dir" || argument.starts_with("--plugin-ports-dir=")
    }) && !args
        .iter()
        .any(|argument| argument == "--plugin-install" || argument.starts_with("--plugin-install="))
    {
        return Err("--plugin-ports-dir requires --plugin-install <category/name>".to_string());
    }
    let has_plugin_uninstall = args.iter().any(|argument| {
        argument == "--plugin-uninstall" || argument.starts_with("--plugin-uninstall=")
    });
    if has_plugin_uninstall
        && args.iter().any(|argument| {
            matches!(
                argument.as_str(),
                "--enable-plugin"
                    | "--disable-plugin"
                    | "--plugin-enable"
                    | "--plugin-disable"
                    | "--plugin-enable-all"
                    | "--plugin-disable-all"
                    | "--plugin-install"
                    | "--plugin-install-file"
                    | "--force"
                    | "--enable"
            ) || argument.starts_with("--enable-plugin=")
                || argument.starts_with("--disable-plugin=")
                || argument.starts_with("--plugin-enable=")
                || argument.starts_with("--plugin-disable=")
                || argument.starts_with("--plugin-install=")
        })
    {
        return Err(
            "--plugin-uninstall cannot be combined with other plugin mutation options".to_string(),
        );
    }
    Ok(())
}

// Checks values whose invalid form previously fell through to a normal launch.
fn validate_direct_cli_value(option: &str, value: &str) -> Result<(), String> {
    let value = sanitize_cli_value(value);
    if value.is_empty() {
        return Err(format!("{option} requires a value"));
    }
    if matches!(option, "--width" | "-W" | "--height" | "-H")
        && value
            .parse::<u32>()
            .ok()
            .filter(|number| *number > 0)
            .is_none()
    {
        return Err(format!("{option} must be a positive integer"));
    }
    if matches!(option, "--size" | "-z") {
        let valid = value
            .split_once('x')
            .or_else(|| value.split_once('X'))
            .and_then(|(width, height)| {
                Some((width.parse::<u32>().ok()?, height.parse::<u32>().ok()?))
            })
            .is_some_and(|(width, height)| width > 0 && height > 0);
        if !valid {
            return Err(format!("{option} must be formatted as <width>x<height>"));
        }
    }
    if matches!(option, "--cwd" | "-o") {
        resolve_cli_start_directory(&value)?;
    }
    if matches!(
        option,
        "--completion" | "--completion-install" | "--completion-uninstall"
    ) && !matches!(
        value.to_ascii_lowercase().as_str(),
        "bash" | "zsh" | "fish" | "powershell"
    ) {
        return Err(format!(
            "{option} supports bash, zsh, fish, or powershell (received {value})"
        ));
    }
    Ok(())
}

// Resolves a CLI directory relative to the caller and verifies that the PTY
// can start there. This is deliberately local-only, unlike OSC 7 reports.
fn resolve_cli_start_directory(value: &str) -> Result<PathBuf, String> {
    let source = Path::new(value.trim());
    let absolute = if source.is_absolute() {
        source.to_path_buf()
    } else {
        env::current_dir()
            .map_err(|error| format!("could not read the current directory: {error}"))?
            .join(source)
    };
    validated_start_directory(&absolute.to_string_lossy(), None)
        .map_err(|error| format!("--cwd {error}"))
}

// Normalizes direct binary arguments into the same environment overrides used by the Node launcher.
fn apply_direct_cli_env_overrides() {
    set_env_from_cli("FPASOTERM_CONFIG_PATH", &["--config", "-c"]);
    set_env_from_cli("FPASOTERM_PROFILE", &["--profile", "-p"]);
    set_env_from_cli("FPASOTERM_SHELL", &["--shell", "-s"]);
    if let Some(path) = cli_option_value_any(&["--cwd", "-o"]) {
        // Argument validation resolved the path before Tauri initialization.
        if let Ok(directory) = resolve_cli_start_directory(&path) {
            env::set_var("FPASOTERM_START_CWD", directory);
        }
    }
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

// Applies the project icon shown by Linux shelves, task switchers, and window managers.
fn set_fpasoterm_window_icon(app: &AppHandle, window: &tauri::WebviewWindow) {
    match tauri::image::Image::from_bytes(include_bytes!("../../extra/logo/fpasoterm.png")) {
        Ok(icon) => {
            if let Err(error) = window.set_icon(icon) {
                eprintln!("failed to set fpasoterm window icon: {error}");
                append_diagnostic(
                    app,
                    &format!("failed to set fpasoterm window icon: {error}"),
                );
            } else {
                append_diagnostic(app, "set fpasoterm window icon");
            }
        }
        Err(error) => {
            eprintln!("failed to load fpasoterm window icon: {error}");
            append_diagnostic(
                app,
                &format!("failed to load fpasoterm window icon: {error}"),
            );
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
    let startup_started_at = now_millis();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(650));
        let event_app = app.clone();
        let _ = app.run_on_main_thread(move || {
            if latest_arrange_request_timestamp()
                .map(|created_at| created_at > startup_started_at)
                .unwrap_or(false)
            {
                append_diagnostic(
                    &event_app,
                    "startup window size restore skipped because Tile was requested",
                );
                install_window_state_persistence(event_app, window, state_path, remember);
                return;
            }
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

// Reads the timestamp of the latest cross-process Tile request.
fn latest_arrange_request_timestamp() -> Option<u128> {
    let value: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(arrange_request_path()).ok()?).ok()?;
    value
        .get("createdAt")
        .and_then(serde_json::Value::as_u64)
        .map(u128::from)
}

// Reads live window markers so Tile can use names rather than process IDs.
fn live_arrange_instances() -> Vec<ArrangeInstance> {
    let directory = cache_dir_path().join("instances");
    let mut instances = Vec::new();
    if let Ok(entries) = fs::read_dir(&directory) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("pid") {
                continue;
            }
            let Some(pid) = path
                .file_stem()
                .and_then(|value| value.to_str())
                .and_then(|value| value.parse::<u32>().ok())
            else {
                continue;
            };
            if !instance_marker_is_live(pid, &path) {
                let _ = fs::remove_file(path);
                continue;
            }
            let (base_title, display_title) = read_instance_marker_titles(&path)
                .unwrap_or_else(|| ("fpasoterm".to_string(), "fpasoterm".to_string()));
            let created_at = fs::read_to_string(&path)
                .ok()
                .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
                .and_then(|value| value.get("createdAt").and_then(serde_json::Value::as_u64))
                .unwrap_or(0);
            instances.push(ArrangeInstance {
                pid,
                instance_number: instance_number_from_display_title(&base_title, &display_title),
                base_title,
                display_title,
                created_at,
            });
        }
    }
    instances
}

// Sorts title groups naturally, then keeps genuinely equal names deterministic.
fn sort_arrange_instances(instances: &mut [ArrangeInstance]) {
    instances.sort_by(|left, right| {
        left.base_title
            .to_lowercase()
            .cmp(&right.base_title.to_lowercase())
            .then_with(|| left.instance_number.cmp(&right.instance_number))
            .then_with(|| left.display_title.cmp(&right.display_title))
            .then_with(|| left.created_at.cmp(&right.created_at))
            .then_with(|| left.pid.cmp(&right.pid))
    });
}

// Registers this process and returns the zero-based suffix index allocated
// after the largest live suffix for the same configured base title.
fn claim_instance_index(app: &AppHandle, title: &str) -> usize {
    let dir = cache_dir_path().join("instances");
    if let Err(error) = fs::create_dir_all(&dir) {
        append_diagnostic(
            app,
            &format!("failed to create instance marker dir: {error}"),
        );
        return 0;
    }

    let current_pid = std::process::id();
    let mut highest_instance_number = 0usize;
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("pid") {
                continue;
            }
            let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
                continue;
            };
            let Ok(pid) = stem.parse::<u32>() else {
                let _ = fs::remove_file(&path);
                continue;
            };
            if pid == current_pid || instance_marker_is_live(pid, &path) {
                if let Some((base_title, display_title)) = read_instance_marker_titles(&path) {
                    if base_title == title {
                        highest_instance_number = highest_instance_number
                            .max(instance_number_from_display_title(title, &display_title));
                    }
                }
            } else {
                let _ = fs::remove_file(&path);
            }
        }
    }

    let marker_path = dir.join(format!("{current_pid}.pid"));
    let instance_number = highest_instance_number.saturating_add(1).max(1);
    let instance_index = instance_number - 1;
    let display_title = if instance_number == 1 {
        title.to_string()
    } else {
        format!("{title}-{instance_number}")
    };
    let instance_id = app.state::<AppState>().source_id.clone();
    let marker = serde_json::json!({
        "pid": current_pid,
        "instanceId": instance_id,
        "baseTitle": title,
        "title": display_title,
        "createdAt": now_millis()
    });
    if let Err(error) = fs::write(&marker_path, marker.to_string()) {
        append_diagnostic(app, &format!("failed to write instance marker: {error}"));
        return instance_index;
    }
    app.manage(InstanceMarker { path: marker_path });
    append_diagnostic(
        app,
        &format!(
            "startup same-title instance index={instance_index} number={instance_number} title={title}"
        ),
    );
    instance_index
}

// Reads the configured base title and allocated display title from a marker.
fn read_instance_marker_titles(path: &Path) -> Option<(String, String)> {
    let value: serde_json::Value = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;
    let base_title = value
        .get("baseTitle")
        .or_else(|| value.get("title"))?
        .as_str()
        .map(str::to_string)?;
    let display_title = value
        .get("title")
        .and_then(serde_json::Value::as_str)
        .unwrap_or(&base_title)
        .to_string();
    Some((base_title, display_title))
}

// Converts a display title into its one-based instance number.
fn instance_number_from_display_title(base_title: &str, display_title: &str) -> usize {
    if display_title == base_title {
        return 1;
    }
    display_title
        .strip_prefix(&format!("{base_title}-"))
        .and_then(|suffix| suffix.parse::<usize>().ok())
        .filter(|number| *number >= 2)
        .unwrap_or(1)
}

// Prints one stable, script-friendly line for each live application window.
fn print_running_instances() {
    let directory = cache_dir_path().join("instances");
    let mut instances = Vec::new();
    if let Ok(entries) = fs::read_dir(&directory) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("pid") {
                continue;
            }
            let Some(pid) = path
                .file_stem()
                .and_then(|value| value.to_str())
                .and_then(|value| value.parse::<u32>().ok())
            else {
                let _ = fs::remove_file(path);
                continue;
            };
            if !instance_marker_is_live(pid, &path) {
                let _ = fs::remove_file(path);
                continue;
            }
            let value: serde_json::Value = fs::read_to_string(&path)
                .ok()
                .and_then(|text| serde_json::from_str(&text).ok())
                .unwrap_or_default();
            let title = value
                .get("title")
                .or_else(|| value.get("baseTitle"))
                .and_then(serde_json::Value::as_str)
                .unwrap_or("fpasoterm")
                .to_string();
            let created_at = value
                .get("createdAt")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(0);
            instances.push((created_at, pid, title));
        }
    }
    instances.sort_by_key(|(created_at, pid, _)| (*created_at, *pid));
    if instances.is_empty() {
        print_cli_text("No running fpasoterm windows.\n");
        return;
    }
    for (created_at, pid, title) in instances {
        print_cli_text(&format!(
            "session={pid} pid={pid} title={} started={created_at}\n",
            serde_json::to_string(&title).unwrap_or_else(|_| "\"fpasoterm\"".to_string())
        ));
    }
}

// Resolves a PID, exact displayed title, or the reserved all target.
fn broadcast_targeted_close_request(target: &str) -> Result<String, String> {
    let directory = cache_dir_path().join("instances");
    let mut matches = Vec::new();
    if let Ok(entries) = fs::read_dir(&directory) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("pid") {
                continue;
            }
            let Some(pid) = path
                .file_stem()
                .and_then(|value| value.to_str())
                .and_then(|value| value.parse::<u32>().ok())
            else {
                continue;
            };
            if !instance_marker_is_live(pid, &path) {
                let _ = fs::remove_file(path);
                continue;
            }
            let value: serde_json::Value = fs::read_to_string(&path)
                .ok()
                .and_then(|text| serde_json::from_str(&text).ok())
                .unwrap_or_default();
            let title = value
                .get("title")
                .or_else(|| value.get("baseTitle"))
                .and_then(serde_json::Value::as_str)
                .unwrap_or("fpasoterm")
                .to_string();
            if close_target_matches(target, pid, &title) {
                matches.push((pid, title));
            }
        }
    }
    if matches.is_empty() {
        return Err(format!("no running window matches: {target}"));
    }

    fs::create_dir_all(cache_dir_path()).map_err(|error| error.to_string())?;
    let request_path = close_request_path();
    let temporary_path =
        request_path.with_file_name(format!("close-{}.json.tmp", std::process::id()));
    let request = serde_json::json!({
        "createdAt": now_millis(),
        "pids": matches.iter().map(|(pid, _)| *pid).collect::<Vec<_>>()
    });
    fs::write(&temporary_path, request.to_string()).map_err(|error| error.to_string())?;
    let _ = fs::remove_file(&request_path);
    fs::rename(&temporary_path, &request_path).map_err(|error| error.to_string())?;

    Ok(matches
        .into_iter()
        .map(|(pid, title)| {
            format!(
                "requested close session={pid} pid={pid} title={}\n",
                serde_json::to_string(&title).unwrap_or_else(|_| "\"fpasoterm\"".to_string())
            )
        })
        .collect())
}

// Matches the reserved all target, a numeric PID, or an exact display title.
fn close_target_matches(target: &str, pid: u32, title: &str) -> bool {
    target.eq_ignore_ascii_case("all")
        || target
            .parse::<u32>()
            .map_or(title == target, |target_pid| target_pid == pid)
}

// Returns true when a previous marker should still be considered active.
fn instance_marker_is_live(pid: u32, path: &Path) -> bool {
    if !instance_marker_is_fresh(path) {
        return false;
    }
    #[cfg(target_os = "linux")]
    {
        let _ = path;
        return Path::new("/proc").join(pid.to_string()).exists();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = path;
        process_is_live(pid)
    }

    #[cfg(all(not(target_os = "linux"), not(target_os = "windows")))]
    {
        let _ = pid;
        true
    }
}

// Rejects markers that are no longer refreshed by a running instance.
fn instance_marker_is_fresh(path: &Path) -> bool {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .is_some_and(|age| age <= INSTANCE_HEARTBEAT_TIMEOUT)
}

#[cfg(target_os = "windows")]
// Checks whether a Windows process id still belongs to a running process.
fn process_is_live(pid: u32) -> bool {
    const STILL_ACTIVE: u32 = 259;
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle == ptr::null_mut() {
            return false;
        }
        let mut exit_code = 0u32;
        let ok = GetExitCodeProcess(handle, &mut exit_code);
        let _ = CloseHandle(handle);
        ok != 0 && exit_code == STILL_ACTIVE
    }
}

// Returns the shared local file used to broadcast tile requests between instances.
fn arrange_request_path() -> PathBuf {
    cache_dir_path().join("arrange.json")
}

// Returns the shared request file used to close every running instance.
fn close_all_request_path() -> PathBuf {
    cache_dir_path().join("close-all.json")
}

// Returns the targeted close request shared by CLI and running instances.
fn close_request_path() -> PathBuf {
    cache_dir_path().join("close.json")
}

// Listens for placement broadcasts while this process owns its instance marker.
fn start_arrange_listener(app: AppHandle, marker_path: PathBuf, min_width: u32, min_height: u32) {
    std::thread::spawn(move || {
        let mut last_request = now_millis();
        let mut last_heartbeat = SystemTime::now();
        // Ignore a close request left by an earlier application session. Only
        // requests created after this process started may close this window.
        let last_close_request =
            request_timestamp(&close_all_request_path()).unwrap_or_else(now_millis);
        let last_targeted_close_request =
            request_timestamp(&close_request_path()).unwrap_or_else(now_millis);
        loop {
            if !marker_path.exists() {
                break;
            }
            if last_heartbeat
                .elapsed()
                .is_ok_and(|elapsed| elapsed >= INSTANCE_HEARTBEAT_INTERVAL)
            {
                if let Ok(marker) = fs::read(&marker_path) {
                    if let Ok(mut file) = OpenOptions::new().write(true).open(&marker_path) {
                        let _ = file.write_all(&marker);
                    }
                }
                last_heartbeat = SystemTime::now();
            }
            if let Ok(text) = fs::read_to_string(arrange_request_path()) {
                if let Ok(request) = serde_json::from_str::<serde_json::Value>(&text) {
                    let created_at = request
                        .get("createdAt")
                        .and_then(serde_json::Value::as_u64)
                        .map(u128::from)
                        .unwrap_or_default();
                    if created_at > last_request {
                        last_request = created_at;
                        if let Some(bounds) = request
                            .get("windows")
                            .and_then(serde_json::Value::as_array)
                            .and_then(|windows| {
                                windows.iter().find(|item| {
                                    item.get("pid").and_then(serde_json::Value::as_u64)
                                        == Some(u64::from(std::process::id()))
                                })
                            })
                        {
                            let result = app.run_on_main_thread({
                                let app = app.clone();
                                let bounds = bounds.clone();
                                move || {
                                    if let Some(window) = app.get_webview_window("main") {
                                        let x = bounds
                                            .get("x")
                                            .and_then(serde_json::Value::as_i64)
                                            .unwrap_or_default() as i32;
                                        let y = bounds
                                            .get("y")
                                            .and_then(serde_json::Value::as_i64)
                                            .unwrap_or_default() as i32;
                                        let width = bounds
                                            .get("width")
                                            .and_then(serde_json::Value::as_u64)
                                            .unwrap_or(640) as u32;
                                        let height = bounds
                                            .get("height")
                                            .and_then(serde_json::Value::as_u64)
                                            .unwrap_or(480) as u32;
                                        // Tiling may require a cell smaller than the normal
                                        // interactive minimum. Restore the minimum afterwards.
                                        let _ = window.set_min_size(None::<tauri::LogicalSize<u32>>);
                                        let size_result = window.set_size(PhysicalSize::new(width, height));
                                        let position_result = window.set_position(PhysicalPosition::new(x, y));
                                        let _ = window.set_min_size(Some(PhysicalSize::new(
                                            min_width,
                                            min_height,
                                        )));
                                        let actual_position = window.outer_position().ok();
                                        if actual_position
                                            .map(|position| position.x != x || position.y != y)
                                            .unwrap_or(true)
                                        {
                                            append_diagnostic(
                                                &app,
                                                &format!(
                                                    "arrange position rejected pid={} requested=({}, {}) actual={:?}",
                                                    std::process::id(), x, y, actual_position
                                                ),
                                            );
                                        }
                                        append_diagnostic(
                                            &app,
                                            &format!(
                                                "arrange window pid={} x={} y={} width={} height={} size={:?} position={:?}",
                                                std::process::id(), x, y, width, height, size_result, position_result
                                            ),
                                        );
                                    }
                                }
                            });
                            if let Err(error) = result {
                                append_diagnostic(
                                    &app,
                                    &format!("arrange dispatch failed: {error}"),
                                );
                            }
                        }
                    }
                }
            }
            if let Some(created_at) = request_timestamp(&close_all_request_path()) {
                if created_at > last_close_request {
                    let close_app = app.clone();
                    let result = app.run_on_main_thread(move || {
                        exit_requested_app_instance(&close_app);
                    });
                    if let Err(error) = result {
                        append_diagnostic(&app, &format!("close all dispatch failed: {error}"));
                    }
                    break;
                }
            }
            if let Ok(text) = fs::read_to_string(close_request_path()) {
                if let Ok(request) = serde_json::from_str::<serde_json::Value>(&text) {
                    let created_at = request
                        .get("createdAt")
                        .and_then(serde_json::Value::as_u64)
                        .map(u128::from)
                        .unwrap_or_default();
                    let targets_current_process = request
                        .get("pids")
                        .and_then(serde_json::Value::as_array)
                        .is_some_and(|pids| {
                            pids.iter()
                                .any(|pid| pid.as_u64() == Some(u64::from(std::process::id())))
                        });
                    if created_at > last_targeted_close_request && targets_current_process {
                        let close_app = app.clone();
                        let result = app.run_on_main_thread(move || {
                            exit_requested_app_instance(&close_app);
                        });
                        if let Err(error) = result {
                            append_diagnostic(
                                &app,
                                &format!("targeted close dispatch failed: {error}"),
                            );
                        }
                        break;
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    });
}

// Reads a createdAt timestamp from a shared inter-process request file.
fn request_timestamp(path: &Path) -> Option<u128> {
    let value: serde_json::Value = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;
    value
        .get("createdAt")
        .and_then(serde_json::Value::as_u64)
        .map(u128::from)
}

#[tauri::command]
// Collects live instance PIDs and writes a grid placement request for all of them.
fn window_arrange(app: AppHandle, screen: Option<ArrangeScreen>) -> Result<String, String> {
    let current = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    let config = runtime_config();
    let monitor = current
        .current_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "current monitor is not available".to_string())?;
    let (monitor_position, monitor_size, scale_factor, coordinate_scale, screen_source) =
        if let Some(screen) = screen {
            // screen.avail* is reported in logical pixels by WebKit. Tauri's
            // native window APIs use physical pixels, including on ChromeOS.
            let coordinate_scale = screen.device_pixel_ratio.max(0.1);
            (
                PhysicalPosition::new(
                    (screen.left * coordinate_scale).round() as i32,
                    (screen.top * coordinate_scale).round() as i32,
                ),
                PhysicalSize::new(
                    (screen.width * coordinate_scale).round().max(1.0) as u32,
                    (screen.height * coordinate_scale).round().max(1.0) as u32,
                ),
                screen.device_pixel_ratio,
                coordinate_scale,
                "renderer-available-scaled",
            )
        } else {
            (
                *monitor.position(),
                *monitor.size(),
                monitor.scale_factor(),
                1.0,
                "native-monitor",
            )
        };
    let mut instances = live_arrange_instances();
    let current_pid = std::process::id();
    if !instances.iter().any(|instance| instance.pid == current_pid) {
        instances.push(ArrangeInstance {
            pid: current_pid,
            base_title: config.config.window.title.clone(),
            display_title: config.config.window.title.clone(),
            instance_number: 1,
            created_at: now_millis() as u64,
        });
    }
    sort_arrange_instances(&mut instances);
    let pids = instances
        .iter()
        .map(|instance| instance.pid)
        .collect::<Vec<_>>();

    let count = pids.len();
    let (columns, rows) = tile_grid(count);
    // Leave a small physical gap so compositor rounding cannot make adjacent
    // windows touch or overlap at scaled display resolutions.
    let tile_gap = 6u32;
    let horizontal_gaps = tile_gap.saturating_mul(columns.saturating_add(1));
    let vertical_gaps = tile_gap.saturating_mul(rows.saturating_add(1));
    let available_width = monitor_size.width.saturating_sub(horizontal_gaps);
    let available_height = monitor_size.height.saturating_sub(vertical_gaps);
    let footprint_width = (available_width / columns).max(1);
    let footprint_height = (available_height / rows.max(1)).max(1);
    let cell_width = footprint_width;
    let cell_height = footprint_height;
    if cell_width < config.config.window.min_width || cell_height < config.config.window.min_height
    {
        append_diagnostic(
            &app,
            &format!(
                "arrange tile minimum override cells={} footprint={}x{} calculated={}x{} minimum={}x{}",
                columns * rows,
                footprint_width,
                footprint_height,
                cell_width,
                cell_height,
                config.config.window.min_width,
                config.config.window.min_height,
            ),
        );
    }
    let windows = pids
        .iter()
        .enumerate()
        .map(|(index, pid)| ArrangeWindowBounds {
            pid: *pid,
            x: monitor_position.x
                + tile_gap as i32
                + (index as u32 % columns) as i32 * (footprint_width + tile_gap) as i32,
            y: monitor_position.y
                + tile_gap as i32
                + (index as u32 / columns) as i32 * (footprint_height + tile_gap) as i32,
            width: cell_width,
            height: cell_height,
        })
        .collect::<Vec<_>>();
    let request = ArrangeRequest {
        created_at: now_millis(),
        windows: windows.clone(),
    };
    let request_text = serde_json::to_string(&request).map_err(|error| error.to_string())?;
    let request_path = arrange_request_path();
    fs::create_dir_all(cache_dir_path()).map_err(|error| error.to_string())?;
    let temporary_path =
        request_path.with_file_name(format!("arrange-{}.json.tmp", std::process::id()));
    fs::write(&temporary_path, request_text).map_err(|error| error.to_string())?;
    // Windows does not replace an existing destination during rename, so remove
    // the previous broadcast after the complete temporary file is written.
    let _ = fs::remove_file(&request_path);
    fs::rename(&temporary_path, &request_path).map_err(|error| error.to_string())?;
    // Apply the clicked window immediately as well as broadcasting to the
    // other processes, so a listener timing race cannot leave it unchanged.
    if let Some(bounds) = windows.iter().find(|bounds| bounds.pid == current_pid) {
        let clear_min_result = current.set_min_size(None::<tauri::LogicalSize<u32>>);
        let size_result = current.set_size(PhysicalSize::new(bounds.width, bounds.height));
        let position_result = current.set_position(PhysicalPosition::new(bounds.x, bounds.y));
        let restore_min_result = current.set_min_size(Some(PhysicalSize::new(
            config.config.window.min_width,
            config.config.window.min_height,
        )));
        append_diagnostic(
            &app,
            &format!(
                "arrange immediate pid={} bounds=({}, {}, {}, {}) clear_min={:?} size={:?} position={:?} restore_min={:?}",
                current_pid,
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height,
                clear_min_result,
                size_result,
                position_result,
                restore_min_result
            ),
        );
    }
    append_diagnostic(
        &app,
        &format!(
            "arrange requested windows={count} cells={} grid={}x{} gap={} scale={} coordinate_scale={} source={} windows={:?} monitor={:?}",
            columns * rows,
            columns,
            rows,
            tile_gap,
            scale_factor,
            coordinate_scale,
            screen_source,
            instances
                .iter()
                .map(|instance| format!("{}:{}", instance.pid, instance.display_title))
                .collect::<Vec<_>>(),
            monitor_size
        ),
    );
    Ok(format!("arranged {count} fpasoterm windows"))
}

// Chooses a stable grid: even counts use two balanced rows, while perfect
// squares use square grids so nine windows occupy nine rather than twelve cells.
fn tile_grid(count: usize) -> (u32, u32) {
    let count = (count as u32).max(1);
    let square = (count as f64).sqrt() as u32;
    if square.saturating_mul(square) == count {
        return (square.max(1), square.max(1));
    }
    if count == 2 {
        return (2, 1);
    }
    let rows = 2;
    let columns = count.saturating_add(rows - 1) / rows;
    (columns.max(1), rows)
}

#[tauri::command]
// Broadcasts a close request and closes the current window immediately.
fn window_close_all(app: AppHandle) -> Result<String, String> {
    broadcast_close_all_request()?;
    exit_requested_app_instance(&app);
    Ok("closed all fpasoterm windows".to_string())
}

// Exits one application process after a CLI or Close All request.
// On macOS, closing the last window alone intentionally leaves the menu-bar app running.
fn exit_requested_app_instance(app: &AppHandle) {
    app.exit(0);
}

#[tauri::command]
// Starts a separate fpasoterm process so users can open another terminal window.
fn window_new() -> Result<String, String> {
    spawn_new_instance()?;
    Ok("opened a new fpasoterm window".to_string())
}

#[tauri::command]
// Starts another terminal process with an OSC 7-reported local directory.
fn window_new_at_cwd(cwd: String, host: Option<String>) -> Result<String, String> {
    let directory = validated_start_directory(&cwd, host.as_deref())?;
    spawn_new_instance_in_directory(&directory)?;
    Ok(format!(
        "opened a new fpasoterm window in {}",
        directory.display()
    ))
}

// Checks the native mount table instead of treating a persistent record as a
// mounted filesystem. macOS has no mountpoint utility, while `mount` is
// available on every supported Unix platform.
#[cfg(not(windows))]
fn unix_mount_table_contains(mount_point: &Path) -> Result<bool, String> {
    let output = Command::new("mount")
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("cannot inspect mounted filesystems: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "cannot inspect mounted filesystems: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let path = mount_point.display().to_string();
    let macos_prefix = format!(" on {path} (");
    let linux_prefix = format!(" on {path} type ");
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .any(|line| line.contains(&macos_prefix) || line.contains(&linux_prefix)))
}

#[cfg(not(windows))]
fn wait_for_unix_mount_state(mount_point: &Path, expected_active: bool) -> Result<bool, String> {
    for _ in 0..30 {
        if unix_mount_table_contains(mount_point)? == expected_active {
            return Ok(true);
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    Ok(false)
}

// macFUSE retains sshfs after a successful mount, so wait for the mount table
// rather than waiting for the child process to exit.
#[cfg(target_os = "macos")]
fn wait_for_macos_sshfs_mount(child: &mut Child, mount_point: &Path) -> Result<(), String> {
    for _ in 0..50 {
        if unix_mount_table_contains(mount_point)? {
            return Ok(());
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("cannot monitor SSHFS mount: {error}"))?
        {
            let mut detail = String::new();
            if let Some(mut stderr) = child.stderr.take() {
                let _ = stderr.read_to_string(&mut detail);
            }
            let detail = detail.trim();
            return Err(if detail.is_empty() {
                format!("sshfs exited before the mount became active ({status})")
            } else {
                format!("sshfs exited before the mount became active: {detail}")
            });
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    let _ = child.kill();
    let _ = child.wait();
    Err("SSHFS did not become active within 5 seconds; check the host key, credentials, and SSHFS output".to_string())
}

#[tauri::command]
// Mounts through the installed SSHFS implementation without persisting secrets.
#[cfg(not(windows))]
fn sshfs_mount(
    _window: WebviewWindow,
    request: SshfsMountRequest,
) -> Result<SshfsMountResult, String> {
    validate_sshfs_request(&request)?;
    let mount_point = sshfs_mount_root().join(&request.mount_name);
    fs::create_dir_all(&mount_point)
        .map_err(|error| format!("cannot create mount point: {error}"))?;
    let sshfs_program = sshfs_program();
    let mut command = Command::new(&sshfs_program);
    command
        .arg(format!(
            "{}@{}:{}",
            request.user, request.host, request.remote_path
        ))
        .arg(&mount_point)
        .args(["-p", &request.port.to_string()])
        .args([
            "-o",
            "reconnect",
            "-o",
            "ServerAliveInterval=15",
            "-o",
            "ServerAliveCountMax=3",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    // macFUSE can lazily create its XPC mount channel. Keeping sshfs in the
    // foreground avoids the older daemonize path that reports FD_CLOEXEC and
    // can lose that channel when launched by a GUI process.
    #[cfg(target_os = "macos")]
    command.arg("-f");
    command.args(sshfs_local_owner_options());
    if let Some(identity_file) = request
        .identity_file
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        let identity = PathBuf::from(identity_file);
        if !identity.is_file() {
            return Err("SSH identity file does not exist or is not a regular file".to_string());
        }
        command.args(["-o", &format!("IdentityFile={}", identity.display())]);
    }
    let password = request.password.filter(|value| !value.is_empty());
    if password.is_some() {
        command.args(["-o", "password_stdin"]);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("cannot start {}: {error}", sshfs_program.display()))?;
    if let Some(password) = password {
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(format!("{password}\n").as_bytes())
                .map_err(|error| format!("cannot provide SSHFS password: {error}"))?;
        }
    }
    // macFUSE keeps sshfs attached to the mount after a successful mount.
    // Do not wait for process exit, but require a real mount-table entry before
    // reporting success or persisting the FpasoTerm mount record.
    #[cfg(target_os = "macos")]
    wait_for_macos_sshfs_mount(&mut child, &mount_point)?;

    // Linux sshfs normally daemonizes after mounting, so retain its exit-status
    // check to report authentication and option errors to the caller.
    #[cfg(not(target_os = "macos"))]
    {
        let output = child
            .wait_with_output()
            .map_err(|error| error.to_string())?;
        if !output.status.success() {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if detail.is_empty() {
                "sshfs mount failed".to_string()
            } else {
                format!("sshfs mount failed: {detail}")
            });
        }
        if !wait_for_unix_mount_state(&mount_point, true)? {
            return Err("sshfs exited successfully but no mounted filesystem appeared at the requested path".to_string());
        }
    }
    let record = SshfsMountRecord {
        host: request.host,
        user: request.user,
        port: request.port,
        remote_path: request.remote_path,
        mount_name: request.mount_name,
        identity_file: request
            .identity_file
            .filter(|value| !value.trim().is_empty()),
        mount_point: None,
    };
    let mut mounts = read_sshfs_mount_records();
    mounts.retain(|existing| existing.mount_name != record.mount_name);
    mounts.push(record);
    write_sshfs_mount_records(&mounts)?;
    Ok(SshfsMountResult {
        mount_point: mount_point.display().to_string(),
        message: sshfs_mount_ready_message(),
    })
}

// macFUSE retains the sshfs process after mounting, but the mount table has
// already confirmed the requested filesystem is usable before this is called.
#[cfg(target_os = "macos")]
fn sshfs_mount_ready_message() -> String {
    "SSHFS mount is ready; use this path from the terminal or another local application".to_string()
}

#[cfg(not(target_os = "macos"))]
fn sshfs_mount_ready_message() -> String {
    "SSHFS mount is ready; use this path from the terminal or another local application".to_string()
}

// SSHFS-Win officially exposes SSHFS mounts as mapped network drives. Calling
// its Cygwin sshfs.exe directly from a GUI process produces orphaned FUSE
// mounts, so use Windows' network-drive API and matching disconnect API.
#[cfg(windows)]
#[tauri::command]
fn sshfs_mount(
    window: WebviewWindow,
    request: SshfsMountRequest,
) -> Result<SshfsMountResult, String> {
    validate_sshfs_request(&request)?;
    // Windows credentials belong to SSHFS-Win's own interactive dialog. Never
    // forward the optional UI value to a process argument or persistent state.
    let _password_entered_in_ui = request
        .password
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty());
    if request
        .identity_file
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        return Err(
            "Windows SSHFS-Win mapped drives do not accept an identity-file option. Use a host alias and the supported SSHFS-Win key configuration, then leave identity file empty."
                .to_string(),
        );
    }

    let mount_point = windows_available_drive_letter()?;
    let remote = windows_sshfs_unc(&request);
    // A real owner keeps the native SSHFS-Win credential dialog above this
    // terminal and lets Windows restore focus when the dialog closes.
    let owner = window
        .hwnd()
        .map(|handle| handle.0)
        .unwrap_or(std::ptr::null_mut());
    windows_mount_network_drive(&mount_point, &remote, owner)?;
    windows_verify_network_drive(&mount_point)?;

    let record = SshfsMountRecord {
        host: request.host,
        user: request.user,
        port: request.port,
        remote_path: request.remote_path,
        mount_name: request.mount_name,
        identity_file: None,
        mount_point: Some(mount_point.clone()),
    };
    let mut mounts = read_sshfs_mount_records();
    mounts.retain(|existing| existing.mount_name != record.mount_name);
    mounts.push(record);
    write_sshfs_mount_records(&mounts)?;
    Ok(SshfsMountResult {
        mount_point,
        message:
            "SSHFS-Win network drive is ready; use this drive from the terminal or File Explorer"
                .to_string(),
    })
}

// Unmounts only the recorded Windows network drive. The remote credentials are never retained.
#[cfg(windows)]
#[tauri::command]
fn sshfs_unmount(mount_name: String) -> Result<SshfsMountResult, String> {
    sshfs_managed_mount_point(&mount_name)?;
    let mount_point = read_sshfs_mount_records()
        .into_iter()
        .find(|record| record.mount_name == mount_name)
        .and_then(|record| record.mount_point)
        .ok_or_else(|| {
            "this saved mount was created by an older FpasoTerm version without a Windows drive letter; remove its old SSHFS-Win mount manually, then mount it again with this version"
                .to_string()
    })?;
    // SSHFS-Win can acknowledge a normal network-drive disconnect while its
    // provider process keeps the drive alive. Use the normal API first; only
    // offer the explicitly confirmed process fallback when it remains mapped.
    if windows_unmount_network_drive(&mount_point)
        .and_then(|_| windows_verify_network_drive_unmounted(&mount_point))
        .is_err()
    {
        if !windows_confirm_force_sshfs_unmount(&mount_point) {
            return Ok(SshfsMountResult {
                mount_point,
                message: "SSHFS unmount canceled; the network drive remains active".to_string(),
            });
        }
        windows_force_unmount_network_drive(&mount_point)?;
    }
    let mut mounts = read_sshfs_mount_records();
    mounts.retain(|record| record.mount_name != mount_name);
    write_sshfs_mount_records(&mounts)?;
    Ok(SshfsMountResult {
        mount_point,
        message: "SSHFS mount was removed".to_string(),
    })
}

// Unmounts only an FpasoTerm-managed Unix mount path.
#[cfg(not(windows))]
#[tauri::command]
fn sshfs_unmount(mount_name: String) -> Result<SshfsMountResult, String> {
    let mount_path = sshfs_managed_mount_point(&mount_name)?;
    if !unix_mount_table_contains(&mount_path)? {
        return Err(format!(
            "SSHFS mount is not active at {}; its saved record was kept so it can be mounted again",
            mount_path.display()
        ));
    }
    let mount_point = mount_path.display().to_string();
    let candidates: Vec<(&str, Vec<String>)> = vec![
        ("fusermount3", vec!["-u".to_string(), mount_point.clone()]),
        ("fusermount", vec!["-u".to_string(), mount_point.clone()]),
        ("umount", vec![mount_point.clone()]),
    ];
    let mut last_error = String::new();
    for (program, args) in candidates {
        match Command::new(program)
            .args(&args)
            .stdin(Stdio::null())
            .output()
        {
            Ok(output) if output.status.success() => {
                if wait_for_unix_mount_state(&mount_path, false)? {
                    let mut mounts = read_sshfs_mount_records();
                    mounts.retain(|record| record.mount_name != mount_name);
                    write_sshfs_mount_records(&mounts)?;
                    return Ok(SshfsMountResult {
                        mount_point: mount_point.clone(),
                        message: "SSHFS mount was removed".to_string(),
                    });
                }
                last_error = "unmount command returned success but the filesystem remains mounted"
                    .to_string();
            }
            Ok(output) => last_error = String::from_utf8_lossy(&output.stderr).trim().to_string(),
            Err(error) => last_error = error.to_string(),
        }
    }
    Err(format!("cannot unmount {}: {last_error}", mount_point))
}

// Removes only an inactive saved record, without touching a live filesystem.
#[tauri::command]
fn sshfs_forget(mount_name: String) -> Result<SshfsMountResult, String> {
    let managed_path = sshfs_managed_mount_point(&mount_name)?;
    let mut mounts = read_sshfs_mount_records();
    let record = mounts
        .iter()
        .find(|record| record.mount_name == mount_name)
        .ok_or_else(|| "no saved SSHFS mount has that name".to_string())?
        .clone();
    #[cfg(not(windows))]
    if unix_mount_table_contains(&managed_path)? {
        return Err(format!(
            "SSHFS mount is still active at {}; unmount it before forgetting the saved record",
            managed_path.display()
        ));
    }
    #[cfg(windows)]
    if record
        .mount_point
        .as_deref()
        .is_some_and(|mount_point| windows_verify_network_drive(mount_point).is_ok())
    {
        return Err(
            "SSHFS-Win drive is still active; unmount it before forgetting the saved record"
                .to_string(),
        );
    }
    mounts.retain(|item| item.mount_name != mount_name);
    write_sshfs_mount_records(&mounts)?;
    Ok(SshfsMountResult {
        mount_point: record
            .mount_point
            .unwrap_or_else(|| managed_path.display().to_string()),
        message: "inactive SSHFS saved mount was forgotten".to_string(),
    })
}

#[tauri::command]
fn sshfs_unmount_all() -> Result<String, String> {
    let mut failures = Vec::new();
    for mount in read_sshfs_mount_records() {
        if let Err(error) = sshfs_unmount(mount.mount_name.clone()) {
            failures.push(format!("{}: {error}", mount.mount_name));
        }
    }
    if failures.is_empty() {
        Ok("all SSHFS mounts were removed".to_string())
    } else {
        Err(format!(
            "could not unmount all SSHFS mounts: {}",
            failures.join("; ")
        ))
    }
}

#[tauri::command]
// Reports the managed root and whether sshfs is available without making a network connection.
fn sshfs_status() -> Result<SshfsStatus, String> {
    let root = sshfs_mount_root();
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let sshfs_program = sshfs_program();
    let mounts = read_sshfs_mount_records();
    // SSHFS-Win documents the direct Cygwin executable as unsuitable for GUI
    // use. Running `sshfs.exe --version` here can flash a helper window, so
    // Windows availability is determined from the installed executable path.
    #[cfg(windows)]
    let available = sshfs_program.is_file();
    #[cfg(not(windows))]
    let available = Command::new(&sshfs_program)
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    #[cfg(not(windows))]
    let active_mount_names = mounts
        .iter()
        .filter(|record| {
            unix_mount_table_contains(&sshfs_mount_root().join(&record.mount_name)).unwrap_or(false)
        })
        .map(|record| record.mount_name.clone())
        .collect();
    #[cfg(windows)]
    let active_mount_names = mounts
        .iter()
        .filter(|record| {
            record
                .mount_point
                .as_deref()
                .is_some_and(|path| windows_verify_network_drive(path).is_ok())
        })
        .map(|record| record.mount_name.clone())
        .collect();
    Ok(SshfsStatus {
        mount_root: root.display().to_string(),
        available,
        program_path: sshfs_program.display().to_string(),
        mounts,
        active_mount_names,
    })
}

// Keeps mounts under the per-user FpasoTerm directory instead of accepting arbitrary system paths.
fn sshfs_mount_root() -> PathBuf {
    PathBuf::from(runtime_config().config_dir).join("mounts")
}

fn sshfs_mount_records_path() -> PathBuf {
    sshfs_mount_root().join("sshfs-mounts.json")
}

fn read_sshfs_mount_records() -> Vec<SshfsMountRecord> {
    fs::read_to_string(sshfs_mount_records_path())
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_sshfs_mount_records(records: &[SshfsMountRecord]) -> Result<(), String> {
    fs::create_dir_all(sshfs_mount_root()).map_err(|error| error.to_string())?;
    fs::write(
        sshfs_mount_records_path(),
        serde_json::to_string_pretty(records).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn sshfs_managed_mount_point(name: &str) -> Result<PathBuf, String> {
    if name.is_empty()
        || !name.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
    {
        return Err(
            "mount name may contain only letters, numbers, dot, hyphen, and underscore".to_string(),
        );
    }
    Ok(sshfs_mount_root().join(name))
}

fn validate_sshfs_request(request: &SshfsMountRequest) -> Result<(), String> {
    let valid_name = |value: &str| {
        !value.is_empty()
            && value.len() <= 253
            && value.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_')
            })
    };
    if !valid_name(&request.host) || !valid_name(&request.user) {
        return Err(
            "SSH host and user may contain only letters, numbers, dot, hyphen, and underscore"
                .to_string(),
        );
    }
    if request.port == 0
        || !request.remote_path.starts_with('/')
        || request.remote_path.contains('\0')
    {
        return Err("SSH port must be valid and remote path must be an absolute path".to_string());
    }
    sshfs_managed_mount_point(&request.mount_name).map(|_| ())
}

fn sshfs_program() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Some(path) = env::var_os("FPASOTERM_SSHFS_PATH")
            .filter(|path| !path.is_empty())
            .map(PathBuf::from)
        {
            return path;
        }
        for variable in ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(root) = env::var_os(variable) {
                let candidate = PathBuf::from(root)
                    .join("SSHFS-Win")
                    .join("bin")
                    .join("sshfs.exe");
                if candidate.is_file() {
                    return candidate;
                }
            }
        }
        PathBuf::from("sshfs.exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("sshfs")
    }
}

// Finds an available drive letter for SSHFS-Win without relying on shell output
// or locale-specific parsing of `net use`.
#[cfg(windows)]
fn windows_available_drive_letter() -> Result<String, String> {
    use windows_sys::Win32::Storage::FileSystem::GetLogicalDrives;

    let drives = unsafe { GetLogicalDrives() };
    for letter in (b'D'..=b'Z').rev() {
        let bit = 1u32 << u32::from(letter - b'A');
        if drives & bit == 0 {
            return Ok(format!("{}:", char::from(letter)));
        }
    }
    Err("no unused Windows drive letter is available for SSHFS-Win".to_string())
}

// Builds SSHFS-Win's root-directory UNC syntax without invoking a shell.
#[cfg(windows)]
fn windows_sshfs_unc(request: &SshfsMountRequest) -> String {
    let path = request
        .remote_path
        .trim_start_matches('/')
        .replace('/', "\\");
    let remote = format!(
        r"\\sshfs.r\{}@{}!{}",
        request.user, request.host, request.port
    );
    // SSHFS-Win documents the root mapping without a trailing separator. A
    // trailing `\\` is treated differently by some provider versions and can
    // fail after the credential dialog with ERROR_NETNAME_DELETED (64).
    if path.is_empty() {
        remote
    } else {
        format!(r"{remote}\{path}")
    }
}

// Ask the SSHFS-Win network provider to create a normal Windows drive mapping.
// SSHFS-Win owns the credential dialog, matching Explorer and `net use`.
#[cfg(windows)]
fn windows_mount_network_drive(
    mount_point: &str,
    remote: &str,
    owner: windows_sys::Win32::Foundation::HWND,
) -> Result<(), String> {
    use windows_sys::Win32::NetworkManagement::WNet::{
        WNetAddConnection3W, CONNECT_INTERACTIVE, CONNECT_PROMPT, CONNECT_TEMPORARY, NETRESOURCEW,
        RESOURCETYPE_DISK,
    };

    let mut local = windows_wide(mount_point);
    let mut remote = windows_wide(remote);
    let resource = NETRESOURCEW {
        // SSHFS-Win implements a disk provider. RESOURCETYPE_ANY is rejected
        // by some provider versions with Windows error 66.
        dwType: RESOURCETYPE_DISK,
        lpLocalName: local.as_mut_ptr(),
        lpRemoteName: remote.as_mut_ptr(),
        ..Default::default()
    };
    let result = unsafe {
        WNetAddConnection3W(
            owner,
            &resource,
            std::ptr::null(),
            std::ptr::null(),
            CONNECT_TEMPORARY | CONNECT_INTERACTIVE | CONNECT_PROMPT,
        )
    };
    // The provider may have already removed the drive while returning this
    // status. The verification immediately after this call is authoritative.
    if result == 0 || result == 2250 {
        Ok(())
    } else {
        let guidance = " SSHFS-Win should show its credential dialog; verify that WinFsp and SSHFS-Win are installed and retry.";
        Err(format!(
            "SSHFS-Win network-drive mount failed (Windows error {result}: {}){guidance}",
            std::io::Error::from_raw_os_error(result as i32),
        ))
    }
}

// Requests explicit consent before ending the SSHFS-Win provider process.
// SSHFS-Win cannot reliably associate a mapped drive with one process, so this
// may also disconnect other SSHFS-Win mounts owned by the current Windows user.
#[cfg(windows)]
fn windows_confirm_force_sshfs_unmount(mount_point: &str) -> bool {
    let message: Vec<u16> = format!(
        "SSHFS-Win did not release {mount_point}.\n\nFpasoTerm can force the disconnect by ending sshfs.exe. This can disconnect other SSHFS-Win mounts available to this Windows user.\n\nContinue?"
    )
    .encode_utf16()
    .chain(std::iter::once(0))
    .collect();
    let title: Vec<u16> = "Force SSHFS-Win unmount?"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        MessageBoxW(
            ptr::null_mut(),
            message.as_ptr(),
            title.as_ptr(),
            MB_OKCANCEL | MB_ICONWARNING | MB_SETFOREGROUND | MB_TASKMODAL | MB_TOPMOST,
        ) == IDOK
    }
}

// Ends the provider only after the native confirmation, then verifies that the
// recorded drive is genuinely gone before deleting its FpasoTerm record.
#[cfg(windows)]
fn windows_force_unmount_network_drive(mount_point: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = Command::new("taskkill")
        .args(["/F", "/IM", "sshfs.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("could not start taskkill for SSHFS-Win: {error}"))?;

    // A provider process may already have exited. Always try the disconnect
    // and let the following mapping check decide whether recovery succeeded.
    let _ = windows_unmount_network_drive(mount_point);
    if windows_verify_network_drive_unmounted(mount_point).is_ok() {
        return Ok(());
    }

    let details = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let details = if details.is_empty() {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        details
    };
    Err(format!(
        "SSHFS-Win still reports {mount_point} as mapped after ending sshfs.exe{}",
        if details.is_empty() {
            String::new()
        } else {
            format!(": {details}")
        }
    ))
}

// WNet can report a successful provider interaction before a drive letter is
// usable. Verify the mapping in this logon session before persisting it.
#[cfg(windows)]
fn windows_verify_network_drive(mount_point: &str) -> Result<(), String> {
    use windows_sys::Win32::NetworkManagement::WNet::WNetGetConnectionW;

    let mount_point = windows_wide(mount_point);
    let mut remote = vec![0u16; 32_768];
    let mut length = remote.len() as u32;
    let result =
        unsafe { WNetGetConnectionW(mount_point.as_ptr(), remote.as_mut_ptr(), &mut length) };
    if result != 0 {
        return Err(format!(
            "SSHFS-Win did not create the assigned drive {} (Windows error {result}: {})",
            String::from_utf16_lossy(&mount_point[..mount_point.len().saturating_sub(1)]),
            std::io::Error::from_raw_os_error(result as i32),
        ));
    }
    let actual = String::from_utf16_lossy(&remote[..usize::try_from(length).unwrap_or(0)]);
    if actual.trim_matches('\0').is_empty() {
        return Err("SSHFS-Win created an empty network-drive mapping".to_string());
    }
    Ok(())
}

// Waits briefly for the network provider to release the local device name.
// A successful cancel call alone does not prove that the mapped drive is gone.
#[cfg(windows)]
fn windows_verify_network_drive_unmounted(mount_point: &str) -> Result<(), String> {
    use windows_sys::Win32::NetworkManagement::WNet::WNetGetConnectionW;

    let mount_point_wide = windows_wide(mount_point);
    for delay in [0, 100, 300] {
        if delay > 0 {
            std::thread::sleep(Duration::from_millis(delay));
        }
        let mut remote = vec![0u16; 32_768];
        let mut length = remote.len() as u32;
        let result = unsafe {
            WNetGetConnectionW(mount_point_wide.as_ptr(), remote.as_mut_ptr(), &mut length)
        };
        // ERROR_NOT_CONNECTED means the drive mapping is no longer present.
        if result == 2250 {
            return Ok(());
        }
        if result != 0 {
            return Err(format!(
                "could not verify SSHFS-Win unmount for {mount_point} (Windows error {result}: {})",
                std::io::Error::from_raw_os_error(result as i32),
            ));
        }
    }
    Err(format!(
        "SSHFS-Win still reports {mount_point} as mapped after unmount; close applications using the drive and retry"
    ))
}

// WNetCancelConnection2W reverses the temporary mapping made by the mount API.
#[cfg(windows)]
fn windows_unmount_network_drive(mount_point: &str) -> Result<(), String> {
    use windows_sys::Win32::NetworkManagement::WNet::WNetCancelConnection2W;

    let mount_point = windows_wide(mount_point);
    let result = unsafe { WNetCancelConnection2W(mount_point.as_ptr(), 0, 1) };
    if result == 0 {
        Ok(())
    } else {
        Err(format!(
            "cannot unmount {mount_point:?} (Windows error {result}: {})",
            std::io::Error::from_raw_os_error(result as i32)
        ))
    }
}

// Converts strings to the null-terminated UTF-16 form expected by Windows APIs.
#[cfg(windows)]
fn windows_wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

// Linux SSHFS otherwise exposes remote numeric ownership, which commonly appears as root:root.
#[cfg(unix)]
fn sshfs_local_owner_options() -> Vec<String> {
    use std::os::unix::fs::MetadataExt;
    fs::metadata(home_dir())
        .map(|metadata| {
            vec![
                "-o".to_string(),
                "idmap=user".to_string(),
                "-o".to_string(),
                format!("uid={}", metadata.uid()),
                "-o".to_string(),
                format!("gid={}", metadata.gid()),
            ]
        })
        .unwrap_or_default()
}

// Runs the current executable again without inheriting per-instance runtime
// overrides. The child loads the base config and claims its own title suffix.
fn spawn_new_instance() -> Result<(), String> {
    spawn_new_instance_in_directory(&PathBuf::from(home_dir()))
}

// Runs another fpasoterm process with a validated PTY starting directory.
fn spawn_new_instance_in_directory(directory: &Path) -> Result<(), String> {
    let executable = env::current_exe().map_err(|error| error.to_string())?;
    Command::new(executable)
        .current_dir(directory)
        .env("FPASOTERM_START_CWD", directory)
        .env_remove("FPASOTERM_RUNTIME_CONFIG_JSON")
        .env_remove("FPASOTERM_RUNTIME_CONFIG_SOURCE")
        .env_remove("FPASOTERM_RUNTIME_CONFIG_OWNER_PID")
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

// Accepts only an existing local absolute directory for a new OSC 7 window.
fn validated_start_directory(value: &str, osc_host: Option<&str>) -> Result<PathBuf, String> {
    if let Some(host) = osc_host.map(str::trim).filter(|host| !host.is_empty()) {
        if !is_local_osc_host(host) {
            return Err("OSC 7 current directory belongs to a remote host".to_string());
        }
    }
    let path = Path::new(value.trim());
    if value.len() > 4096 || value.chars().any(char::is_control) || !path.is_absolute() {
        return Err("OSC 7 current directory must be a local absolute path".to_string());
    }
    let metadata = fs::metadata(path)
        .map_err(|error| format!("OSC 7 current directory is unavailable: {error}"))?;
    if !metadata.is_dir() {
        return Err("OSC 7 current directory is not a directory".to_string());
    }
    Ok(path.to_path_buf())
}

// Accepts the host spellings emitted by local shell integrations and rejects
// OSC 7 reports from remote SSH hosts before any local filesystem access.
fn is_local_osc_host(host: &str) -> bool {
    if host.eq_ignore_ascii_case("localhost") {
        return true;
    }
    let normalized = host.trim_end_matches('.');
    let local_hostname = env::var("HOSTNAME")
        .ok()
        .or_else(|| env::var("COMPUTERNAME").ok())
        .unwrap_or_default();
    normalized.eq_ignore_ascii_case(local_hostname.trim_end_matches('.'))
}

// Detaches GUI launches entered from a macOS fpasoterm shell so the invoking
// prompt does not wait for the newly opened application window to close.
#[cfg(target_os = "macos")]
fn detach_nested_macos_launch() -> bool {
    if env::var("TERM_PROGRAM").as_deref() != Ok("fpasoterm")
        || env::var("FPASOTERM_DETACHED_LAUNCH").as_deref() == Ok("1")
        || cli_has_flag(&["--foreground", "-F"])
    {
        return false;
    }
    let Ok(executable) = env::current_exe() else {
        return false;
    };
    let mut command = Command::new(executable);
    command
        .args(env::args_os().skip(1))
        .env_remove("TERM_PROGRAM")
        .env("FPASOTERM_DETACHED_LAUNCH", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command.spawn().is_ok()
}

#[cfg(not(target_os = "macos"))]
fn detach_nested_macos_launch() -> bool {
    false
}

// Opens a separate native confirmation window so the prompt is visible even
// when the terminal content is busy or visually obscured.
#[tauri::command]
fn window_confirm_close_all(app: AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // A native dialog remains operable even if a secondary WebView fails to
        // load, and Windows supplies keyboard navigation plus a working close button.
        if let Some(window) = app.get_webview_window("close-all-confirm") {
            let _ = window.close();
        }
        if windows_confirm_close_all() {
            broadcast_close_all_request()?;
            return Ok("closed all fpasoterm windows".to_string());
        }
        let _ = window_focus_main(app);
        return Ok("close all canceled".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(window) = app.get_webview_window("close-all-confirm") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            return Ok("close confirmation already open".to_string());
        }
        let window = WebviewWindowBuilder::new(
            &app,
            "close-all-confirm",
            WebviewUrl::App("confirm.html".into()),
        )
        .title("Confirm close all fpasoterm windows")
        .inner_size(600.0, 280.0)
        .min_inner_size(520.0, 220.0)
        .resizable(true)
        .decorations(true)
        .transparent(false)
        .visible(true)
        .always_on_top(true)
        .focused(true)
        .center()
        .build()
        .map_err(|error| error.to_string())?;
        // Make the new native window receive keyboard input immediately.
        let _ = window.set_focus();
        Ok("close confirmation opened".to_string())
    }
}

#[cfg(target_os = "windows")]
// Uses the Windows standard modal dialog instead of a failure-prone secondary WebView.
fn windows_confirm_close_all() -> bool {
    let message: Vec<u16> =
        "Close all running fpasoterm windows?\n\nThis will terminate every fpasoterm window."
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
    let title: Vec<u16> = "Confirm close all fpasoterm windows"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        MessageBoxW(
            ptr::null_mut(),
            message.as_ptr(),
            title.as_ptr(),
            MB_OKCANCEL | MB_ICONWARNING | MB_SETFOREGROUND | MB_TASKMODAL | MB_TOPMOST,
        ) == IDOK
    }
}

// Restores keyboard focus to the terminal after a confirmation window closes.
#[tauri::command]
fn window_focus_main(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

// Closes the confirmation window and restores focus to the terminal atomically.
#[tauri::command]
fn window_cancel_close_all(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("close-all-confirm") {
        let _ = window.close();
    }
    window_focus_main(app)
}

// Broadcasts the close request from the independent confirmation window.
#[tauri::command]
fn window_close_all_confirmed(
    app: AppHandle,
    unmount_sshfs: Option<bool>,
) -> Result<String, String> {
    if unmount_sshfs.unwrap_or(false) {
        sshfs_unmount_all()?;
    }
    broadcast_close_all_request()?;
    if let Some(window) = app.get_webview_window("close-all-confirm") {
        let _ = window.close();
    }
    Ok("closed all fpasoterm windows".to_string())
}

// Writes one atomic close request consumed by every running fpasoterm process.
fn broadcast_close_all_request() -> Result<(), String> {
    let request_path = close_all_request_path();
    fs::create_dir_all(cache_dir_path()).map_err(|error| error.to_string())?;
    let request_text = serde_json::json!({ "createdAt": now_millis() }).to_string();
    let temporary_path =
        request_path.with_file_name(format!("close-all-{}.json.tmp", std::process::id()));
    fs::write(&temporary_path, request_text).map_err(|error| error.to_string())?;
    let _ = fs::remove_file(&request_path);
    fs::rename(&temporary_path, &request_path).map_err(|error| error.to_string())?;
    Ok(())
}

// Applies a visible suffix and a subtle color variation for same-title windows.
fn apply_instance_identity(config: &mut RuntimeConfig, instance_index: usize) {
    if instance_index == 0 {
        return;
    }

    config.config.window.title = format!("{}-{}", config.config.window.title, instance_index + 1);
    config.config.window.titlebar_color =
        varied_titlebar_color(&config.config.window.titlebar_color, instance_index)
            .unwrap_or_else(|| config.config.window.titlebar_color.clone());
}

// Re-publishes startup mutations so renderer-side config_get sees the same title
// and titlebar color that the native window received during setup. The owner
// PID prevents terminal-shell children from reusing this process snapshot.
fn publish_runtime_config(config: &RuntimeConfig) {
    if let Ok(value) = serde_json::to_string(config) {
        env::set_var("FPASOTERM_RUNTIME_CONFIG_JSON", value);
        env::set_var("FPASOTERM_RUNTIME_CONFIG_SOURCE", "native");
        env::set_var(
            "FPASOTERM_RUNTIME_CONFIG_OWNER_PID",
            std::process::id().to_string(),
        );
    }
}

// Returns a slightly adjusted color for later same-title windows.
fn varied_titlebar_color(color: &str, instance_index: usize) -> Option<String> {
    let (red, green, blue, alpha) = parse_css_color(color)?;
    let amount = (0.12 * ((instance_index + 1) / 2) as f32).min(0.42);
    let lighten = instance_index % 2 == 1;
    let adjust = |value: u8| -> u8 {
        if lighten {
            value + ((255 - value) as f32 * amount).round() as u8
        } else {
            ((value as f32) * (1.0 - amount)).round() as u8
        }
    };
    Some(match alpha {
        Some(alpha) => format!(
            "rgba({}, {}, {}, {})",
            adjust(red),
            adjust(green),
            adjust(blue),
            alpha
        ),
        None => format!(
            "#{:02x}{:02x}{:02x}",
            adjust(red),
            adjust(green),
            adjust(blue)
        ),
    })
}

// Parses common titlebar color formats used by config.toml examples.
fn parse_css_color(color: &str) -> Option<(u8, u8, u8, Option<String>)> {
    let source = color.trim();
    if let Some(hex) = source.strip_prefix('#') {
        return parse_hex_color(hex);
    }
    parse_rgb_color(source)
}

// Parses #rgb and #rrggbb titlebar colors.
fn parse_hex_color(hex: &str) -> Option<(u8, u8, u8, Option<String>)> {
    let expanded = match hex.len() {
        3 => hex
            .chars()
            .flat_map(|character| [character, character])
            .collect::<String>(),
        6 => hex.to_string(),
        _ => return None,
    };
    let red = u8::from_str_radix(&expanded[0..2], 16).ok()?;
    let green = u8::from_str_radix(&expanded[2..4], 16).ok()?;
    let blue = u8::from_str_radix(&expanded[4..6], 16).ok()?;
    Some((red, green, blue, None))
}

// Parses rgb(...) and rgba(...) titlebar colors.
fn parse_rgb_color(source: &str) -> Option<(u8, u8, u8, Option<String>)> {
    let inner = source
        .strip_prefix("rgb(")
        .and_then(|value| value.strip_suffix(')'))
        .map(|value| (value, None))
        .or_else(|| {
            source
                .strip_prefix("rgba(")
                .and_then(|value| value.strip_suffix(')'))
                .map(|value| (value, Some(())))
        })?;
    let parts = inner.0.split(',').map(str::trim).collect::<Vec<_>>();
    if parts.len() < 3 {
        return None;
    }
    let parse_component = |value: &str| -> Option<u8> {
        let number = value.parse::<f32>().ok()?;
        Some(number.round().clamp(0.0, 255.0) as u8)
    };
    Some((
        parse_component(parts[0])?,
        parse_component(parts[1])?,
        parse_component(parts[2])?,
        inner
            .1
            .and_then(|_| parts.get(3).map(|value| (*value).to_string())),
    ))
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

// Returns whether an inherited snapshot belongs to this process. Terminal
// shells inherit their parent's environment, so a native snapshot must only be
// used by the process whose PID published it.
fn should_use_runtime_config_json_values(
    source: Option<&str>,
    owner_pid: Option<&str>,
    current_pid: &str,
) -> bool {
    if source == Some("launcher") {
        return true;
    }

    source == Some("native") && owner_pid == Some(current_pid)
}

// Checks process ownership before consuming an inherited runtime JSON snapshot.
fn should_use_runtime_config_json() -> bool {
    let current_pid = std::process::id().to_string();
    should_use_runtime_config_json_values(
        env::var("FPASOTERM_RUNTIME_CONFIG_SOURCE").ok().as_deref(),
        env::var("FPASOTERM_RUNTIME_CONFIG_OWNER_PID")
            .ok()
            .as_deref(),
        &current_pid,
    )
}

// Loads a valid launcher/current-process JSON config, falling back to direct
// config.toml parsing for a packaged binary or terminal-launched child.
fn runtime_config() -> RuntimeConfig {
    let mut config = if should_use_runtime_config_json() {
        env::var("FPASOTERM_RUNTIME_CONFIG_JSON")
            .ok()
            .and_then(|value| serde_json::from_str(&value).ok())
            .unwrap_or_else(direct_runtime_config)
    } else {
        direct_runtime_config()
    };
    migrate_legacy_terminal_font_family(&mut config);
    migrate_legacy_terminal_line_height(&mut config);
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
    apply_saved_window_bounds(&mut config);
    config
}

// Applies remembered bounds only after the selected TOML has set
// window.rememberBounds and its state-file directory.
fn apply_saved_window_bounds(runtime: &mut RuntimeConfig) {
    if !runtime.config.window.remember_bounds {
        return;
    }
    if let Some((width, height)) = read_saved_window_size(&runtime.window_state_path) {
        runtime.config.window.width = width;
        runtime.config.window.height = height;
    }
}

const DEFAULT_TERMINAL_FONT_FAMILY: &str = "\"DejaVu Sans Mono\", \"Noto Sans Mono\", \"Noto Sans Mono CJK JP\", \"Noto Sans Mono CJK KR\", \"Noto Sans Mono CJK SC\", \"NanumGothicCoding\", \"BIZ UDGothic\", \"Symbols Nerd Font Mono\", \"Symbols Nerd Font\", \"JetBrainsMono Nerd Font\", \"Noto Sans CJK JP\", \"Noto Sans CJK KR\", \"Noto Sans CJK SC\", \"Noto Sans CJK TC\", \"Hiragino Kaku Gothic ProN\", \"Apple SD Gothic Neo\", \"Malgun Gothic\", Meiryo, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const LEGACY_MACOS_TERMINAL_FONT_FAMILY: &str = "\"SF Mono\", Menlo, ui-monospace, SFMono-Regular, \"Symbols Nerd Font Mono\", \"Symbols Nerd Font\", \"JetBrainsMono Nerd Font\", \"Noto Sans CJK JP\", \"Noto Sans CJK KR\", \"Noto Sans CJK SC\", \"Noto Sans CJK TC\", \"Hiragino Kaku Gothic ProN\", \"Apple SD Gothic Neo\", \"Malgun Gothic\", Meiryo, monospace";
const MACOS_TERMINAL_FONT_FAMILY: &str = "Menlo, \"SF Mono\", ui-monospace, SFMono-Regular, \"Symbols Nerd Font Mono\", \"Symbols Nerd Font\", \"JetBrainsMono Nerd Font\", \"Noto Sans CJK JP\", \"Noto Sans CJK KR\", \"Noto Sans CJK SC\", \"Noto Sans CJK TC\", \"Hiragino Kaku Gothic ProN\", \"Apple SD Gothic Neo\", \"Malgun Gothic\", Meiryo, monospace";
const LEGACY_TERMINAL_FONT_FAMILY: &str = "\"Noto Sans Mono CJK JP\", \"Noto Sans CJK JP\", \"BIZ UDGothic\", \"Hiragino Sans\", Meiryo, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const LEGACY_NERD_FIRST_TERMINAL_FONT_FAMILY: &str = "\"Symbols Nerd Font Mono\", \"Symbols Nerd Font\", \"JetBrainsMono Nerd Font\", \"Noto Sans Mono CJK JP\", \"Noto Sans Mono CJK KR\", \"Noto Sans Mono CJK SC\", \"Noto Sans CJK JP\", \"Noto Sans CJK KR\", \"Noto Sans CJK SC\", \"Noto Sans CJK TC\", \"NanumGothicCoding\", \"BIZ UDGothic\", \"Hiragino Sans\", \"Hiragino Kaku Gothic ProN\", \"Apple SD Gothic Neo\", \"Malgun Gothic\", Meiryo, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Matches the Intel macOS renderer default to the host's more compact terminal metrics.
fn default_terminal_font_size() -> u32 {
    terminal_font_size_for(env::consts::OS, env::consts::ARCH)
}

// Uses compact glyph rows so block-art logos do not show a visible gap.
fn default_terminal_line_height() -> f64 {
    terminal_line_height_for(env::consts::OS, env::consts::ARCH)
}

// Uses installed macOS monospace fonts before proportional Japanese fallbacks.
fn default_terminal_font_family() -> &'static str {
    terminal_font_family_for(env::consts::OS)
}

// Keeps the platform font order testable from non-macOS CI hosts.
fn terminal_font_family_for(platform: &str) -> &'static str {
    if platform == "macos" {
        MACOS_TERMINAL_FONT_FAMILY
    } else {
        DEFAULT_TERMINAL_FONT_FAMILY
    }
}

// Replaces only previously shipped defaults after parsing a user config file.
fn migrate_legacy_terminal_font_family(runtime: &mut RuntimeConfig) {
    let Some(font_family) = runtime
        .config
        .terminal
        .get("fontFamily")
        .and_then(|value| value.as_str())
    else {
        return;
    };
    if font_family == LEGACY_TERMINAL_FONT_FAMILY
        || font_family == LEGACY_NERD_FIRST_TERMINAL_FONT_FAMILY
        || (env::consts::OS == "macos" && font_family == LEGACY_MACOS_TERMINAL_FONT_FAMILY)
        || (env::consts::OS == "macos" && font_family == DEFAULT_TERMINAL_FONT_FAMILY)
    {
        runtime.config.terminal["fontFamily"] =
            serde_json::Value::String(default_terminal_font_family().to_string());
    }
}

// Migrates former compact defaults while preserving explicit user values.
fn migrate_legacy_terminal_line_height(runtime: &mut RuntimeConfig) {
    let line_height = runtime
        .config
        .terminal
        .get("lineHeight")
        .and_then(serde_json::Value::as_f64);
    let former_default = line_height == Some(1.12)
        || (env::consts::OS == "macos" && line_height == Some(0.81))
        || (env::consts::OS == "macos" && line_height == Some(0.82))
        || (env::consts::OS == "macos" && line_height == Some(0.85))
        || (env::consts::OS == "macos" && line_height == Some(0.8))
        || line_height == Some(0.8)
        || line_height == Some(0.92)
        || (env::consts::OS == "macos" && line_height == Some(0.9));
    if former_default {
        runtime.config.terminal["lineHeight"] = serde_json::json!(default_terminal_line_height());
    }
}

// Keeps the platform rule testable from non-macOS CI hosts.
fn terminal_font_size_for(platform: &str, architecture: &str) -> u32 {
    if platform == "macos" && architecture == "x86_64" {
        12
    } else {
        14
    }
}

// Keeps platform terminal cell heights testable from CI hosts.
fn terminal_line_height_for(platform: &str, _architecture: &str) -> f64 {
    if platform == "macos" {
        1.0
    } else {
        1.0
    }
}

// Parses the user-facing terminal.encoding setting without guessing byte encodings.
fn terminal_output_encoding(config: &Config) -> TerminalEncoding {
    match config
        .terminal
        .get("encoding")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("utf-8")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "shift-jis" | "shift_jis" | "sjis" => TerminalEncoding::ShiftJis,
        "euc-jp" | "euc_jp" | "eucjp" => TerminalEncoding::EucJp,
        _ => TerminalEncoding::Utf8,
    }
}

// Returns the canonical setting name shown in diagnostics and persisted to TOML.
fn terminal_encoding_name(encoding: TerminalEncoding) -> &'static str {
    match encoding {
        TerminalEncoding::Utf8 => "utf-8",
        TerminalEncoding::ShiftJis => "shift-jis",
        TerminalEncoding::EucJp => "euc-jp",
    }
}

// Uses a UTF-8 locale for modern terminal output when the launcher inherited a
// non-UTF-8 locale. This prevents macOS utilities from replacing path bytes with '?'.
fn configure_utf8_terminal_locale(command: &mut CommandBuilder, encoding: TerminalEncoding) {
    if encoding != TerminalEncoding::Utf8 || cfg!(windows) {
        return;
    }
    let inherited = ["LC_ALL", "LC_CTYPE", "LANG"]
        .iter()
        .filter_map(|name| env::var(name).ok())
        .find(|value| !value.trim().is_empty())
        .unwrap_or_default();
    if inherited.to_ascii_lowercase().contains("utf-8")
        || inherited.to_ascii_lowercase().contains("utf8")
    {
        return;
    }
    let locale = if cfg!(target_os = "macos") {
        "en_US.UTF-8"
    } else {
        "C.UTF-8"
    };
    command.env("LC_ALL", locale);
    command.env("LC_CTYPE", locale);
    command.env("LANG", locale);
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
    let mut toml_value: toml::Value = toml::from_str(&text).map_err(|error| error.to_string())?;
    let selected_profile = toml_value
        .as_table_mut()
        .and_then(|table| table.remove("profiles"))
        .and_then(|profiles| profiles.as_table().cloned())
        .and_then(|profiles| profiles.get(&config.active_profile).cloned());
    if !config.active_profile.is_empty() && selected_profile.is_none() {
        return Err(format!(
            "profile '{}' does not exist in {}",
            config.active_profile,
            absolute_path.display()
        ));
    }
    let override_value = serde_json::to_value(toml_value).map_err(|error| error.to_string())?;
    let mut config_value =
        serde_json::to_value(&config.config).map_err(|error| error.to_string())?;
    merge_json_value(&mut config_value, override_value);
    if let Some(profile) = selected_profile {
        let profile_value = serde_json::to_value(profile).map_err(|error| error.to_string())?;
        merge_json_value(&mut config_value, profile_value);
    }
    config.config = serde_json::from_value(config_value).map_err(|error| error.to_string())?;
    migrate_legacy_terminal_font_family(&mut config);
    migrate_legacy_terminal_line_height(&mut config);
    config.config_path = absolute_path.to_string_lossy().to_string();
    config.config_dir = absolute_path
        .parent()
        .map(|parent| parent.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string());
    config.window_state_path = format!("{}/window-state.json", config.config_dir);
    config.plugin_urls = resolve_direct_plugin_urls(&config.config, Path::new(&config.config_dir));
    Ok(config)
}

// Percent-encodes a filesystem path as a file URL that the renderer converts
// to Tauri's scoped asset protocol before loading a trusted local plugin.
fn file_url_from_path(path: &Path) -> Option<String> {
    let path = path.canonicalize().ok()?;
    let raw = normalize_file_url_path(&path.to_string_lossy().replace('\\', "/"));
    let bytes = raw.as_bytes();
    let mut encoded = String::new();
    for byte in bytes {
        if byte.is_ascii_alphanumeric() || matches!(*byte, b'/' | b'-' | b'_' | b'.' | b'~' | b':')
        {
            encoded.push(*byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    if encoded.starts_with('/') {
        Some(format!("file://{encoded}"))
    } else {
        Some(format!("file:///{encoded}"))
    }
}

// Removes the Windows extended-length prefix emitted by canonicalize() before
// URL encoding. Leaving `//?/` in a file URL produces `file:////%3F/C:/...`,
// which WebView cannot convert back to a valid Windows asset path.
fn normalize_file_url_path(path: &str) -> String {
    path.strip_prefix("//?/").unwrap_or(path).to_string()
}

// Creates isolated cached plugin scripts for direct packaged-binary launches.
// The sample .ts plugins are JavaScript-compatible; TypeScript-only syntax
// still requires the Node launcher to transpile before loading.
fn resolve_direct_plugin_urls(config: &Config, config_dir: &Path) -> Vec<PluginUrl> {
    let enabled = config
        .plugins
        .get("enabled")
        .and_then(serde_json::Value::as_array)
        .cloned()
        .unwrap_or_default();
    let plugin_root = config_dir.join("plugins");
    let cache_root = config_dir.join("cache").join("plugins");
    let canonical_root = plugin_root.canonicalize().ok();
    let mut urls = Vec::new();
    for entry in enabled {
        let Some(name) = entry.as_str() else {
            continue;
        };
        let source_path = config_dir.join(name);
        let extension = source_path.extension().and_then(|value| value.to_str());
        if !matches!(extension, Some("js" | "ts")) || !source_path.is_file() {
            continue;
        }
        let Ok(canonical_source) = source_path.canonicalize() else {
            continue;
        };
        if !canonical_root
            .as_ref()
            .is_some_and(|root| canonical_source.starts_with(root))
        {
            continue;
        }
        let Ok(relative) =
            canonical_source.strip_prefix(canonical_root.as_ref().expect("plugin root"))
        else {
            continue;
        };
        let cache_path = cache_root.join(relative).with_extension("js");
        let Ok(source) = fs::read_to_string(&canonical_source) else {
            continue;
        };
        if fs::create_dir_all(cache_path.parent().unwrap_or(&cache_root)).is_err()
            || fs::write(&cache_path, format!("(() => {{\n{source}\n}})();\n")).is_err()
        {
            continue;
        }
        if let Some(url) = file_url_from_path(&cache_path) {
            urls.push(PluginUrl {
                name: name.replace('\\', "/"),
                url,
            });
        }
    }
    urls
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
    let config_path = env::var("FPASOTERM_CONFIG_PATH")
        .ok()
        .or_else(|| cli_option_value_any(&["--config", "-c"]))
        .unwrap_or_else(|| format!("{home}/.config/fpasoterm/User/config.toml"));
    let config_dir = Path::new(&config_path)
        .parent()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{home}/.config/fpasoterm/User"));
    // A missing plugin directory is normal on a first launch. Do not make a
    // read-only custom config path fatal, but prepare User/plugins when writable.
    let _ = fs::create_dir_all(Path::new(&config_dir).join("plugins"));
    let window_state_path = format!("{config_dir}/window-state.json");
    let window = WindowConfig {
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
    RuntimeConfig {
        config: Config {
            window,
            terminal: serde_json::json!({
                "allowTransparency": true,
                "cursorBlink": true,
                "cursorStyle": "block",
                "fontFamily": default_terminal_font_family(),
                "fontSize": default_terminal_font_size(),
                "lineHeight": default_terminal_line_height(),
                "backgroundOpacity": 0.65,
                "minimumContrastRatio": 1,
                "rescaleOverlappingGlyphs": false,
                "scrollback": 1000,
                "termName": "xterm-256color",
                "encoding": "utf-8",
                "shell": read_configured_shell(&config_path).unwrap_or_default(),
                "images": {
                    "enabled": false,
                    "kittySupport": false,
                    "kittySizeLimit": 33554432,
                    "storageLimit": 64,
                    "sixelSupport": false,
                    "iipSupport": false
                },
                "theme": {
                    "background": "rgba(16, 19, 23, 0.65)",
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
            keybindings: serde_json::json!({
                "prefix": "Mod+Shift",
                "logMenu": "L",
                "logToggle": "S",
                "logShow": "P",
                "copy": "C",
                "paste": "V",
                "menu": "M",
                "help": "H",
                "newWindow": "N",
                "openCwd": "o",
                "broadcast": "B",
                "kill": "K",
                "tile": "T",
                "closeAll": "X"
            }),
            plugins: serde_json::json!({ "enabled": [] }),
            sync: serde_json::json!({
                "enabled": false,
                "provider": "folder",
                "path": "",
                "channel": "default",
                "diagnostics": true,
                "maxBytes": 1048576,
                "commands": false,
                "commandSecret": "",
                "commandTtlSeconds": 60
            }),
            logging: serde_json::json!({
                "enabled": true,
                "directory": "",
                "autoStart": false,
                "maxBytes": 10485760
            }),
            security: serde_json::json!({
                "osc52": "trusted",
                "osc52MaxBytes": 65536,
                "osc7": true,
                "osc133": true,
                "osc8Open": false,
                "oscNotifications": false,
                "oscNotificationMinIntervalMs": 5000
            }),
        },
        config_dir: config_dir.clone(),
        config_path,
        plugin_urls: Vec::new(),
        window_state_path,
        active_profile: env::var("FPASOTERM_PROFILE")
            .ok()
            .or_else(|| cli_option_value_any(&["--profile", "-p"]))
            .unwrap_or_default(),
        diagnostics: Some(DiagnosticsConfig {
            debug_keys: env::var("FPASOTERM_DEBUG_KEYS").as_deref() == Ok("1")
                || cli_has_flag(&["--debug-keys", "-k"]),
            console_diagnostics: env::var("FPASOTERM_CONSOLE_DIAGNOSTICS").as_deref() == Ok("1")
                || cli_has_flag(&["--console-diagnostics", "-C"]),
        }),
    }
}

// Resolves the user's home directory on Unix-like systems and Windows.
fn home_dir() -> String {
    env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string())
}

// Resolves the per-user cache directory used for launcher logs and runtime markers.
fn cache_dir_path() -> PathBuf {
    env::var("XDG_CACHE_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(home_dir()).join(".cache"))
        .join("fpasoterm")
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

// Reads an optional positional value without treating a following option as a query.
fn cli_optional_value(flag: &str) -> String {
    let mut args = env::args().skip(1);
    while let Some(argument) = args.next() {
        if argument == flag {
            return args
                .next()
                .filter(|value| !value.starts_with('-'))
                .map(|value| sanitize_cli_value(&value))
                .unwrap_or_default();
        }
    }
    String::new()
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
        let mut stdout = std::io::stdout().lock();
        let _ = stdout.write_all(text.as_bytes());
        let _ = stdout.flush();
    }
}

// Prints one embedded completion script without starting the desktop application.
fn print_completion_cli(shell: &str) {
    match completion_script(shell) {
        Ok((_, script)) => print_cli_text(script),
        Err(error) => {
            print_cli_error(&format!("fpasoterm: {error}\n"));
            std::process::exit(2);
        }
    }
}

// Resolves an embedded script while keeping accepted shell names identical for every CLI action.
fn completion_script(shell: &str) -> Result<(&'static str, &'static str), String> {
    match shell.to_ascii_lowercase().as_str() {
        "bash" => Ok(("bash", COMPLETION_BASH)),
        "zsh" => Ok(("zsh", COMPLETION_ZSH)),
        "fish" => Ok(("fish", COMPLETION_FISH)),
        "powershell" => Ok(("powershell", COMPLETION_POWERSHELL)),
        _ => Err(format!(
            "--completion supports bash, zsh, fish, or powershell (received {shell})"
        )),
    }
}

// Uses only user-owned shell directories; packaged binaries never modify system completion files.
fn completion_install_path(shell: &str) -> Result<PathBuf, String> {
    match shell {
        "bash" => Ok(env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(home_dir()).join(".local/share"))
            .join("bash-completion/completions/fpasoterm")),
        "zsh" => Ok(PathBuf::from(home_dir()).join(".zfunc/_fpasoterm")),
        "fish" => Ok(env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(home_dir()).join(".config"))
            .join("fish/completions/fpasoterm.fish")),
        "powershell" if cfg!(windows) => {
            Ok(PathBuf::from(home_dir()).join(".config/fpasoterm/User/completions/fpasoterm.ps1"))
        }
        "powershell" => {
            Err("powershell completion installation is supported on Windows only".to_string())
        }
        _ => Err(format!(
            "--completion supports bash, zsh, fish, or powershell (received {shell})"
        )),
    }
}

// Decodes the UTF-16LE profile path represented as ASCII-safe Base64 by PowerShell.
#[cfg(windows)]
fn decode_powershell_profile_path(encoded_path: &str) -> Option<PathBuf> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded_path.trim())
        .ok()?;
    if bytes.is_empty() || bytes.len() % 2 != 0 {
        return None;
    }
    let units = bytes
        .chunks_exact(2)
        .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
        .collect::<Vec<_>>();
    let path = String::from_utf16(&units).ok()?;
    (!path.is_empty()).then(|| PathBuf::from(path.trim_start_matches('\u{feff}')))
}

// Queries every available Windows PowerShell host for its profile, supporting redirected Documents directories.
#[cfg(windows)]
fn powershell_profile_paths() -> Result<Vec<PathBuf>, String> {
    let mut profiles = Vec::new();
    for command in ["pwsh.exe", "powershell.exe"] {
        let output = Command::new(command)
            .args([
                "-NoProfile",
                "-Command",
                "[Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($PROFILE.CurrentUserCurrentHost))",
            ])
            .output();
        if let Ok(output) = output {
            let encoded_profile = String::from_utf8_lossy(&output.stdout);
            if output.status.success() {
                if let Some(profile) = decode_powershell_profile_path(&encoded_profile) {
                    if !profiles.iter().any(|candidate| candidate == &profile) {
                        profiles.push(profile);
                    }
                }
            }
        }
    }
    if !profiles.is_empty() {
        return Ok(profiles);
    }
    Err("PowerShell was not found; install it or use --completion powershell manually".to_string())
}

// Adds or removes the explicit marker block without touching unrelated profile content.
#[cfg(windows)]
fn update_powershell_profile(
    profile_path: &Path,
    script_path: Option<&Path>,
) -> Result<(), String> {
    const START: &str = "# >>> fpasoterm completion >>>";
    const END: &str = "# <<< fpasoterm completion <<<";
    let existing = fs::read_to_string(profile_path).unwrap_or_default();
    let mut retained = String::new();
    let mut skipping = false;
    let mut removed_managed_block = false;
    for line in existing.lines() {
        if line == START {
            skipping = true;
            removed_managed_block = true;
            continue;
        }
        if skipping && line == END {
            skipping = false;
            continue;
        }
        if !skipping {
            retained.push_str(line);
            retained.push('\n');
        }
    }
    let retained = retained.trim_end();
    if let Some(script_path) = script_path {
        let escaped = script_path.display().to_string().replace('\'', "''");
        if let Some(parent) = profile_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let separator = if retained.is_empty() { "" } else { "\n\n" };
        fs::write(
            profile_path,
            format!("{retained}{separator}{START}\n. '{escaped}'\n{END}\n"),
        )
        .map_err(|error| error.to_string())?;
    } else if profile_path.exists() && removed_managed_block {
        if retained.is_empty() {
            fs::remove_file(profile_path).map_err(|error| error.to_string())?;
        } else {
            fs::write(profile_path, format!("{retained}\n")).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

// Writes one persistent completion file and, on Windows, a managed PowerShell profile entry.
fn install_completion_cli(shell: &str) -> Result<(), String> {
    let (shell, script) = completion_script(shell)?;
    let target_path = completion_install_path(shell)?;
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&target_path, script).map_err(|error| error.to_string())?;
    #[cfg(windows)]
    if shell == "powershell" {
        let profiles = powershell_profile_paths()?;
        for profile in &profiles {
            update_powershell_profile(profile, Some(&target_path))?;
        }
        let profile_list = profiles
            .iter()
            .map(|profile| profile.display().to_string())
            .collect::<Vec<_>>()
            .join(", ");
        print_cli_text(&format!(
            "updated PowerShell profile{}: {profile_list}\nrestart PowerShell, or run: . $PROFILE\nif scripts are blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned\n",
            if profiles.len() == 1 { "" } else { "s" }
        ));
    }
    print_cli_text(&format!(
        "installed {shell} completion: {}\n",
        target_path.display()
    ));
    Ok(())
}

// Removes only fpasoterm's completion file and managed PowerShell profile block.
fn uninstall_completion_cli(shell: &str) -> Result<(), String> {
    let (shell, _) = completion_script(shell)?;
    let target_path = completion_install_path(shell)?;
    #[cfg(windows)]
    if shell == "powershell" {
        for profile in powershell_profile_paths()? {
            update_powershell_profile(&profile, None)?;
        }
    }
    if target_path.exists() {
        fs::remove_file(&target_path).map_err(|error| error.to_string())?;
        print_cli_text(&format!(
            "removed {shell} completion: {}\n",
            target_path.display()
        ));
    } else {
        print_cli_text(&format!(
            "{shell} completion is not installed: {}\n",
            target_path.display()
        ));
    }
    Ok(())
}

// Prints the resolved direct-binary config without opening the application window.
fn print_show_config() {
    match serde_json::to_string_pretty(&redacted_runtime_config()) {
        Ok(config) => print_cli_text(&(config + "\n")),
        Err(error) => {
            print_cli_error(&format!("fpasoterm: failed to serialize config: {error}\n"));
            std::process::exit(2);
        }
    }
}

// Returns a display-safe config snapshot that never exposes the sync command key.
fn redacted_runtime_config() -> RuntimeConfig {
    redact_runtime_config(runtime_config())
}

// Removes values that must never appear in CLI or diagnostics output.
fn redact_runtime_config(mut runtime: RuntimeConfig) -> RuntimeConfig {
    if let Some(sync) = runtime.config.sync.as_object_mut() {
        if sync.contains_key("commandSecret") {
            sync.insert(
                "commandSecret".to_string(),
                serde_json::Value::String("[redacted]".to_string()),
            );
        }
    }
    runtime
}

// Lists profile tables from the selected TOML without starting the desktop app.
fn print_profile_list_cli() {
    let runtime = default_runtime_config();
    let path = runtime.config_path;
    let config = match read_toml_config_or_empty(&path) {
        Ok(config) => config,
        Err(error) => {
            print_cli_error(&format!("fpasoterm: failed to parse {path}: {error}\n"));
            std::process::exit(2);
        }
    };
    let mut names = config
        .get("profiles")
        .and_then(toml::Value::as_table)
        .map(|profiles| profiles.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    names.sort();
    print_cli_text("Available profiles:\n");
    if names.is_empty() {
        print_cli_text("  (none found)\n");
        return;
    }
    for name in names {
        let selected = if name == runtime.active_profile {
            " [selected]"
        } else {
            ""
        };
        print_cli_text(&format!("  {name}{selected}\n"));
    }
}

// Prevents an unknown or malformed selected profile from silently using defaults.
fn validate_selected_profile_cli() -> Result<(), String> {
    let runtime = default_runtime_config();
    if runtime.active_profile.is_empty() {
        return Ok(());
    }
    let config = read_toml_config_or_empty(&runtime.config_path)?;
    match config
        .get("profiles")
        .and_then(toml::Value::as_table)
        .and_then(|profiles| profiles.get(&runtime.active_profile))
    {
        Some(profile) if profile.is_table() => Ok(()),
        Some(_) => Err(format!(
            "profile '{}' in {} must be a TOML table",
            runtime.active_profile, runtime.config_path
        )),
        None => Err(format!(
            "profile '{}' does not exist in {}",
            runtime.active_profile, runtime.config_path
        )),
    }
}

// Builds the selected TOML validation report without changing it or creating a window.
fn config_check_report() -> (String, bool) {
    let runtime = default_runtime_config();
    let path = runtime.config_path;
    let config = match read_toml_config_or_empty(&path) {
        Ok(config) => config,
        Err(error) => {
            return (
                format!("config: {path}\nstatus: error\n\nerrors:\n- {error}\n"),
                false,
            );
        }
    };
    let mut warnings = Vec::new();
    for key in [
        "terminal.fontSize",
        "window.width",
        "window.height",
        "window.minWidth",
        "window.minHeight",
        "terminal.lineHeight",
        "terminal.scrollback",
        "logging.maxBytes",
    ] {
        if let Some(value) = toml_value_at(&config, key) {
            let positive = value
                .as_integer()
                .map(|number| number > 0)
                .or_else(|| value.as_float().map(|number| number > 0.0))
                .unwrap_or(false);
            if !positive {
                warnings.push(format!("{key} should be a positive number"));
            }
        }
    }
    if let Some(enabled) = toml_value_at(&config, "plugins.enabled") {
        match enabled.as_array() {
            Some(plugins) => {
                let root = Path::new(&path).parent().unwrap_or_else(|| Path::new("."));
                let plugin_root = root.join("plugins");
                for plugin in plugins {
                    let Some(name) = plugin.as_str() else {
                        warnings
                            .push("plugins.enabled should contain .js/.ts file names".to_string());
                        continue;
                    };
                    let candidate = root.join(name);
                    let valid_path = candidate.starts_with(&plugin_root)
                        && matches!(
                            candidate
                                .extension()
                                .and_then(|extension| extension.to_str()),
                            Some("js" | "ts")
                        );
                    if !valid_path {
                        warnings.push(format!("plugins.enabled includes invalid entry {name}"));
                    } else if !candidate.exists() {
                        warnings.push(format!(
                            "plugins.enabled includes {name} but file does not exist"
                        ));
                    }
                }
            }
            None => warnings
                .push("plugins.enabled should be an array of .js/.ts file names".to_string()),
        }
    }
    if let Ok(defaults) = toml::from_str::<toml::Value>(&embedded_default_config_toml()) {
        let mut configured = config.clone();
        let mut unsupported = Vec::new();
        prune_toml_value(&defaults, &mut configured, "", &mut unsupported);
        warnings.extend(
            unsupported
                .into_iter()
                .map(|key| format!("{key} is not a supported configuration key")),
        );
    }
    let mut report = format!("config: {path}\nstatus: ok\n");
    if !warnings.is_empty() {
        report.push_str("\nwarnings:\n");
        for warning in warnings {
            report.push_str(&format!("- {warning}\n"));
        }
    }
    (report, true)
}

// Validates the selected TOML file without changing it or creating a window.
fn config_check_cli() {
    let (report, valid) = config_check_report();
    print_cli_text(&report);
    if !valid {
        std::process::exit(1);
    }
}

// Returns all CLI values for repeatable direct-binary options, including --flag=value.
fn cli_option_values_any(flags: &[&str]) -> Vec<String> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let mut values = Vec::new();
    let mut index = 0;
    while index < args.len() {
        for flag in flags {
            if args[index] == *flag {
                if let Some(value) = args.get(index + 1) {
                    let value = sanitize_cli_value(value);
                    if !value.is_empty() {
                        values.push(value);
                    }
                }
                index += 1;
                break;
            }
            if let Some(value) = args[index].strip_prefix(&format!("{flag}=")) {
                let value = sanitize_cli_value(value);
                if !value.is_empty() {
                    values.push(value);
                }
                break;
            }
        }
        index += 1;
    }
    values
}

// Resolves User/plugins beside the selected config.toml without creating it.
fn plugin_directory(config_path: &str) -> PathBuf {
    Path::new(config_path)
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("plugins")
}

// Finds JavaScript and TypeScript source files below User/plugins.
fn discover_plugin_files(config_path: &str) -> Vec<String> {
    fn visit(root: &Path, directory: &Path, discovered: &mut Vec<String>) {
        let Ok(entries) = fs::read_dir(directory) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                visit(root, &path, discovered);
            } else if path.is_file()
                && matches!(
                    path.extension().and_then(|value| value.to_str()),
                    Some("js" | "ts")
                )
            {
                if let Ok(relative) = path.strip_prefix(root) {
                    discovered.push(format!(
                        "plugins/{}",
                        relative.to_string_lossy().replace('\\', "/")
                    ));
                }
            }
        }
    }

    let root = plugin_directory(config_path);
    let mut discovered = Vec::new();
    visit(&root, &root, &mut discovered);
    discovered.sort();
    discovered
}

// Holds optional metadata declared in a single .js/.ts plugin source file.
#[derive(Debug, PartialEq, Eq)]
struct PluginMetadata {
    version: String,
    description: String,
}

// Parses `// @fpasoterm-plugin version: ...` and description headers while
// preserving a normal leading comment as a backwards-compatible description.
fn plugin_metadata(source: &str) -> PluginMetadata {
    let mut version = None;
    let mut description = None;
    let mut fallback_description = None;
    for line in source.lines() {
        let trimmed = line.trim();
        if let Some(header) = trimmed.strip_prefix("// @fpasoterm-plugin ") {
            if let Some((key, value)) = header.split_once(':') {
                let value = value.trim();
                if !value.is_empty() {
                    match key.trim().to_ascii_lowercase().as_str() {
                        "version" => version = Some(value.to_string()),
                        "description" => description = Some(value.to_string()),
                        _ => {}
                    }
                }
            }
            continue;
        }
        if fallback_description.is_none()
            && trimmed.starts_with("//")
            && !trimmed.starts_with("///")
        {
            fallback_description = Some(trimmed.trim_start_matches('/').trim().to_string());
        }
    }
    PluginMetadata {
        version: version.unwrap_or_else(|| "(not declared)".to_string()),
        description: description
            .or(fallback_description)
            .unwrap_or_else(|| "(no leading plugin comment)".to_string()),
    }
}

// Reads plugin metadata for direct-binary CLI output without evaluating code.
fn read_plugin_metadata(path: &Path) -> PluginMetadata {
    fs::read_to_string(path)
        .map(|source| plugin_metadata(&source))
        .unwrap_or_else(|_| PluginMetadata {
            version: "(not declared)".to_string(),
            description: "(unreadable plugin source)".to_string(),
        })
}

const PUBLIC_PLUGIN_PORTS_RAW_URL: &str =
    "https://raw.githubusercontent.com/oyoguhito/fpasoterm-plugins/main";
const PUBLIC_PLUGIN_MANIFEST_LIMIT: u64 = 64 * 1024;
const PUBLIC_PLUGIN_SOURCE_LIMIT: u64 = 1024 * 1024;

// Holds the narrow manifest fields accepted from the official public ports tree.
struct PublicPluginPort {
    id: String,
    version: String,
    min_fpasoterm_version: String,
    source: String,
    install_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Public metadata read from the fixed official INDEX without downloading plugin code.
struct PublicPluginCatalogEntry {
    id: String,
    name: String,
    version: String,
    author: String,
    description: String,
    license: String,
    min_fpasoterm_version: String,
    install_path: String,
}

// Permits only normal, portable port path components in a public registry request.
fn validate_public_plugin_port_id(value: &str) -> Result<String, String> {
    let id = sanitize_cli_value(value);
    let components = id.split('/').collect::<Vec<_>>();
    if components.len() < 2
        || components.iter().any(|component| {
            component.is_empty()
                || !component.chars().all(|character| {
                    character.is_ascii_alphanumeric() || character == '-' || character == '_'
                })
        })
    {
        return Err(format!(
            "invalid public plugin port '{value}'; use a category/name identifier"
        ));
    }
    Ok(components.join("/"))
}

// Rejects absolute and traversal paths from a downloaded manifest before writing files.
fn safe_public_plugin_relative_path(value: &str) -> bool {
    let path = Path::new(value);
    !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

// Downloads a bounded UTF-8 text file only from the fixed public ports repository.
fn download_public_plugin_file(relative_path: &str, limit: u64) -> Result<String, String> {
    let url = format!("{PUBLIC_PLUGIN_PORTS_RAW_URL}/{relative_path}");
    let response = ureq::get(&url)
        .set(
            "User-Agent",
            concat!("fpasoterm/", env!("CARGO_PKG_VERSION")),
        )
        .timeout(Duration::from_secs(20))
        .call()
        .map_err(|error| format!("could not download {url}: {error}"))?;
    if let Some(length) = response
        .header("Content-Length")
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|length| *length > limit)
    {
        return Err(format!("download from {url} is too large: {length} bytes"));
    }
    let mut text = String::new();
    response
        .into_reader()
        .take(limit + 1)
        .read_to_string(&mut text)
        .map_err(|error| format!("could not read {url}: {error}"))?;
    if text.len() as u64 > limit {
        return Err(format!(
            "download from {url} exceeds the {limit}-byte limit"
        ));
    }
    Ok(text)
}

// Downloads and validates the compact official INDEX without downloading plugin code.
fn public_plugin_catalog_entries() -> Result<Vec<PublicPluginCatalogEntry>, String> {
    let index = download_public_plugin_file("INDEX", 256 * 1024)?;
    index
        .lines()
        .enumerate()
        .map(|(line_number, line)| {
            let fields = line.split('|').collect::<Vec<_>>();
            if fields.len() != 8 || fields.iter().any(|field| field.trim().is_empty()) {
                return Err(format!("official INDEX:{} is malformed", line_number + 1));
            }
            let id = validate_public_plugin_port_id(fields[0])?;
            if !safe_public_plugin_relative_path(fields[7]) {
                return Err(format!(
                    "official INDEX:{} has an invalid install path",
                    line_number + 1
                ));
            }
            Ok(PublicPluginCatalogEntry {
                id,
                name: fields[1].to_string(),
                version: fields[2].to_string(),
                author: fields[3].to_string(),
                description: fields[4].to_string(),
                license: fields[5].to_string(),
                min_fpasoterm_version: fields[6].to_string(),
                install_path: fields[7].to_string(),
            })
        })
        .collect()
}

#[tauri::command]
// Exposes only fixed-repository catalog metadata to trusted renderer plugins.
fn plugin_catalog() -> Result<Vec<PublicPluginCatalogEntry>, String> {
    public_plugin_catalog_entries()
}

// Searches bounded public metadata without downloading or evaluating plugin source.
fn public_plugin_search_text(query: &str) -> Result<String, String> {
    let needle = query.trim().to_ascii_lowercase();
    let matches = public_plugin_catalog_entries()?
        .into_iter()
        .filter(|entry| {
            [&entry.id, &entry.name, &entry.author, &entry.description]
                .iter()
                .any(|value| value.to_ascii_lowercase().contains(&needle))
        })
        .collect::<Vec<_>>();
    let mut lines = vec![if needle.is_empty() {
        "Public plugins:".to_string()
    } else {
        format!("Public plugins matching \"{query}\":")
    }];
    lines.push("source: remote official INDEX (oyoguhito/fpasoterm-plugins)".to_string());
    if matches.is_empty() {
        lines.push("  (none)".to_string());
    } else {
        for entry in matches {
            lines.push(format!(
                "  {} ({} {}, {}, requires >= {})\n    {}\n    install: fpasoterm --plugin-install {} --enable",
                entry.id,
                entry.name,
                entry.version,
                entry.author,
                entry.min_fpasoterm_version,
                entry.description,
                entry.id,
            ));
        }
    }
    Ok(format!("{}\n", lines.join("\n")))
}

// Parses only the metadata needed to install a single public port safely.
fn parse_public_plugin_manifest(
    requested_id: &str,
    source: &str,
) -> Result<PublicPluginPort, String> {
    let manifest: toml::Value = toml::from_str(source)
        .map_err(|error| format!("public port manifest is not valid TOML: {error}"))?;
    let port = manifest
        .get("port")
        .and_then(toml::Value::as_table)
        .ok_or_else(|| "public port manifest does not contain [port]".to_string())?;
    let required = |key: &str| {
        port.get(key)
            .and_then(toml::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .ok_or_else(|| format!("public port manifest is missing port.{key}"))
    };
    let id = required("id")?;
    if id != requested_id {
        return Err(format!(
            "public port manifest id mismatch: requested {requested_id}, received {id}"
        ));
    }
    let source_name = required("source")?;
    if !safe_public_plugin_relative_path(&source_name)
        || Path::new(&source_name).components().count() != 1
        || !matches!(
            Path::new(&source_name)
                .extension()
                .and_then(|value| value.to_str()),
            Some("js" | "ts")
        )
    {
        return Err("public port manifest has an invalid source file name".to_string());
    }
    let install_path = required("installPath")?;
    if !safe_public_plugin_relative_path(&install_path)
        || !matches!(
            Path::new(&install_path)
                .extension()
                .and_then(|value| value.to_str()),
            Some("js" | "ts")
        )
    {
        return Err("public port manifest has an invalid installPath".to_string());
    }
    Ok(PublicPluginPort {
        id,
        version: required("version")?,
        min_fpasoterm_version: required("minFpasotermVersion")?,
        source: source_name,
        install_path,
    })
}

// Compares required stable major.minor.patch versions without accepting prerelease labels.
fn public_plugin_version_at_least(current: &str, required: &str) -> bool {
    let parse = |value: &str| {
        let parts = value.split('.').collect::<Vec<_>>();
        (parts.len() == 3).then(|| {
            parts
                .iter()
                .map(|part| part.parse::<u32>().ok())
                .collect::<Option<Vec<_>>>()
        })?
    };
    match (parse(current), parse(required)) {
        (Some(current), Some(required)) => current >= required,
        _ => false,
    }
}

// Writes one verified plugin source into User/plugins without following symlinked destinations.
fn install_plugin_source(
    config_path: &str,
    port: &PublicPluginPort,
    source: String,
    force: bool,
) -> Result<String, String> {
    if !source.contains("window.fpasotermPluginApi") {
        return Err(format!("{} is not a fpasoterm renderer plugin", port.id));
    }
    if !source.contains(&format!("@fpasoterm-plugin version: {}", port.version)) {
        return Err(format!(
            "{} has a mismatched plugin version header",
            port.id
        ));
    }

    let plugin_root = plugin_directory(config_path);
    fs::create_dir_all(&plugin_root).map_err(|error| error.to_string())?;
    let canonical_root = plugin_root
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let destination = plugin_root.join(&port.install_path);
    let destination_parent = destination
        .parent()
        .ok_or_else(|| "public port destination has no parent directory".to_string())?;
    fs::create_dir_all(destination_parent).map_err(|error| error.to_string())?;
    let canonical_parent = destination_parent
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !canonical_parent.starts_with(&canonical_root) {
        return Err("public port destination escapes User/plugins".to_string());
    }
    if let Ok(metadata) = fs::symlink_metadata(&destination) {
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "refusing to replace symlinked plugin {}",
                destination.display()
            ));
        }
        if !force {
            return Err(format!(
                "{} already exists; review it and rerun with --force to replace it",
                destination.display()
            ));
        }
    }
    let temporary = destination.with_extension(format!(
        "{}.fpasoterm-download-{}",
        destination
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("tmp"),
        std::process::id()
    ));
    fs::write(&temporary, source).map_err(|error| error.to_string())?;
    if destination.exists() {
        fs::remove_file(&destination).map_err(|error| error.to_string())?;
    }
    fs::rename(&temporary, &destination).map_err(|error| error.to_string())?;
    Ok(format!("plugins/{}", port.install_path.replace('\\', "/")))
}

// Copies a verified official port source into User/plugins without following symlinked directories.
fn install_public_plugin_port(
    config_path: &str,
    selector: &str,
    force: bool,
) -> Result<String, String> {
    let id = validate_public_plugin_port_id(selector)?;
    let manifest_text = download_public_plugin_file(
        &format!("ports/{id}/port.toml"),
        PUBLIC_PLUGIN_MANIFEST_LIMIT,
    )?;
    let port = parse_public_plugin_manifest(&id, &manifest_text)?;
    let current_version = env!("CARGO_PKG_VERSION");
    if !public_plugin_version_at_least(current_version, &port.min_fpasoterm_version) {
        return Err(format!(
            "{} requires fpasoterm >= {}; current version is {}",
            port.id, port.min_fpasoterm_version, current_version
        ));
    }
    let source = download_public_plugin_file(
        &format!("ports/{}/{}", port.id, port.source),
        PUBLIC_PLUGIN_SOURCE_LIMIT,
    )?;
    install_plugin_source(config_path, &port, source, force)
}

// Locates a checked-out fpasoterm-plugins tree for reviewed local port installs.
fn local_plugin_ports_directory(explicit: Option<String>) -> Result<PathBuf, String> {
    let directory = explicit
        .map(PathBuf::from)
        .ok_or_else(|| "--plugin-ports-dir requires a path".to_string())?;
    if directory.join("ports").is_dir() {
        Ok(directory)
    } else {
        Err(
            "local fpasoterm-plugins checkout not found; pass --plugin-ports-dir <path>"
                .to_string(),
        )
    }
}

// Reads a bounded regular local source file and rejects symlinks before copying it.
fn read_local_plugin_file(path: &Path, limit: u64, label: &str) -> Result<String, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("could not read {label} {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!("{label} {} must be a regular file", path.display()));
    }
    if metadata.len() > limit {
        return Err(format!(
            "{label} {} exceeds the {limit}-byte limit",
            path.display()
        ));
    }
    fs::read_to_string(path)
        .map_err(|error| format!("could not read {label} {}: {error}", path.display()))
}

// Installs a reviewed port from a local fpasoterm-plugins checkout without network access.
fn install_local_plugin_port(
    config_path: &str,
    selector: &str,
    ports_directory: Option<String>,
    force: bool,
) -> Result<String, String> {
    let id = validate_public_plugin_port_id(selector)?;
    let root = local_plugin_ports_directory(ports_directory)?;
    let port_directory = root.join("ports").join(&id);
    let manifest = read_local_plugin_file(
        &port_directory.join("port.toml"),
        PUBLIC_PLUGIN_MANIFEST_LIMIT,
        "local port manifest",
    )?;
    let port = parse_public_plugin_manifest(&id, &manifest)?;
    if !public_plugin_version_at_least(env!("CARGO_PKG_VERSION"), &port.min_fpasoterm_version) {
        return Err(format!(
            "{} requires fpasoterm >= {}; current version is {}",
            port.id,
            port.min_fpasoterm_version,
            env!("CARGO_PKG_VERSION")
        ));
    }
    let source = read_local_plugin_file(
        &port_directory.join(&port.source),
        PUBLIC_PLUGIN_SOURCE_LIMIT,
        "local plugin source",
    )?;
    install_plugin_source(config_path, &port, source, force)
}

// Copies one explicit trusted local plugin file into User/plugins without requiring a ports tree.
fn install_local_plugin_file(
    config_path: &str,
    source_path: &str,
    force: bool,
) -> Result<String, String> {
    let path = PathBuf::from(source_path);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "--plugin-install-file requires a .js or .ts file".to_string())?;
    if !matches!(
        path.extension().and_then(|value| value.to_str()),
        Some("js" | "ts")
    ) {
        return Err("--plugin-install-file requires a .js or .ts file".to_string());
    }
    let source = read_local_plugin_file(&path, PUBLIC_PLUGIN_SOURCE_LIMIT, "local plugin source")?;
    let metadata = plugin_metadata(&source);
    if metadata.version == "(not declared)" {
        return Err(
            "local plugin source must declare // @fpasoterm-plugin version: <version>".to_string(),
        );
    }
    let port = PublicPluginPort {
        id: file_name.to_string(),
        version: metadata.version,
        min_fpasoterm_version: env!("CARGO_PKG_VERSION").to_string(),
        source: file_name.to_string(),
        install_path: file_name.to_string(),
    };
    install_plugin_source(config_path, &port, source, force)
}

// Resolves a filename or plugins-relative selector with an optional .js/.ts suffix.
fn resolve_plugin_selector(
    selector: &str,
    candidates: &[String],
    action: &str,
) -> Result<String, String> {
    let normalized = selector
        .replace('\\', "/")
        .trim_start_matches("./")
        .trim_start_matches("plugins/")
        .to_string();
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.starts_with("../")
        || normalized.contains("/../")
    {
        return Err(format!("invalid plugin name: {selector}"));
    }
    let extensionless = !normalized.ends_with(".js") && !normalized.ends_with(".ts");
    let matches = candidates
        .iter()
        .filter(|candidate| {
            let relative = candidate.trim_start_matches("plugins/");
            let candidate_selector = if normalized.contains('/') {
                relative
            } else {
                Path::new(relative)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or_default()
            };
            candidate_selector == normalized.as_str()
                || (extensionless
                    && candidate_selector
                        .strip_suffix(".js")
                        .or_else(|| candidate_selector.strip_suffix(".ts"))
                        == Some(normalized.as_str()))
        })
        .cloned()
        .collect::<Vec<_>>();
    match matches.as_slice() {
        [] => Err(format!(
            "cannot {action} plugin '{selector}': no matching plugin file"
        )),
        [plugin] => Ok(plugin.clone()),
        _ => Err(format!(
            "plugin name '{selector}' is ambiguous; use one of: {}",
            matches.join(", ")
        )),
    }
}

// Reads the explicit plugins.enabled entries while tolerating malformed config values.
fn configured_plugins(config: &toml::Value) -> Vec<String> {
    config
        .get("plugins")
        .and_then(toml::Value::as_table)
        .and_then(|plugins| plugins.get("enabled"))
        .and_then(toml::Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(toml::Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

// Writes plugins.enabled while preserving every unrelated user setting.
fn set_configured_plugins(config: &mut toml::Value, enabled: Vec<String>) -> Result<(), String> {
    let table = config
        .as_table_mut()
        .ok_or_else(|| "config.toml must contain a top-level TOML table".to_string())?;
    let plugins = table
        .entry("plugins".to_string())
        .or_insert_with(|| toml::Value::Table(toml::map::Map::new()))
        .as_table_mut()
        .ok_or_else(|| "[plugins] must be a TOML table".to_string())?;
    plugins.insert(
        "enabled".to_string(),
        toml::Value::Array(enabled.into_iter().map(toml::Value::String).collect()),
    );
    Ok(())
}

// Displays discovered sources and the explicit enabled selection without opening a window.
fn print_plugin_list_cli(config_path: &str, enabled: &[String]) {
    let available = discover_plugin_files(config_path);
    let config_dir = Path::new(config_path)
        .parent()
        .unwrap_or_else(|| Path::new("."));
    print_cli_text("Local plugins (User/plugins):\n");
    if available.is_empty() {
        print_cli_text("  (none found)\n");
    } else {
        for plugin in available {
            let metadata = read_plugin_metadata(&config_dir.join(&plugin));
            print_cli_text(&format!("  {plugin} [version {}]\n", metadata.version));
        }
    }
    print_cli_text("\nEnabled plugins:\n");
    if enabled.is_empty() {
        print_cli_text("  (none enabled)\n");
    } else {
        for plugin in enabled {
            print_cli_text(&format!("  {plugin}\n"));
        }
    }
}

// Removes trusted local plugin sources and their generated cache files without touching remote ports.
fn uninstall_local_plugins_cli(
    config_path: &str,
    config: &mut toml::Value,
    enabled: &[String],
    selectors: &[String],
) -> Result<Vec<String>, String> {
    let available = discover_plugin_files(config_path);
    let mut selected = Vec::new();
    for selector in selectors {
        for name in selector
            .split(',')
            .map(str::trim)
            .filter(|name| !name.is_empty())
        {
            let plugin = resolve_plugin_selector(name, &available, "uninstall")?;
            if !selected.contains(&plugin) {
                selected.push(plugin);
            }
        }
    }
    if selected.is_empty() {
        return Err("--plugin-uninstall requires at least one plugin name".to_string());
    }

    let config_dir = Path::new(config_path)
        .parent()
        .unwrap_or_else(|| Path::new("."));
    let plugin_root = plugin_directory(config_path);
    let canonical_root = plugin_root
        .canonicalize()
        .map_err(|error| format!("cannot read User/plugins: {error}"))?;
    let mut paths = Vec::new();
    for plugin in &selected {
        let source_path = config_dir.join(plugin);
        let metadata = fs::symlink_metadata(&source_path)
            .map_err(|error| format!("cannot uninstall plugin '{plugin}': {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err(format!("refusing to uninstall symlinked plugin: {plugin}"));
        }
        if !metadata.is_file() {
            return Err(format!(
                "cannot uninstall plugin '{plugin}': source is not a regular file"
            ));
        }
        let canonical_source = source_path
            .canonicalize()
            .map_err(|error| format!("cannot resolve plugin '{plugin}': {error}"))?;
        let relative = canonical_source
            .strip_prefix(&canonical_root)
            .map_err(|_| format!("refusing to uninstall plugin outside User/plugins: {plugin}"))?;
        paths.push((
            plugin.clone(),
            source_path,
            config_dir
                .join("cache")
                .join("plugins")
                .join(relative)
                .with_extension("js"),
        ));
    }

    for (_, source_path, cache_path) in &paths {
        fs::remove_file(source_path).map_err(|error| error.to_string())?;
        if let Ok(metadata) = fs::symlink_metadata(cache_path) {
            if !metadata.file_type().is_symlink() && metadata.is_file() {
                fs::remove_file(cache_path).map_err(|error| error.to_string())?;
            }
        }
    }
    let next_enabled = enabled
        .iter()
        .filter(|plugin| !selected.contains(plugin))
        .cloned()
        .collect::<Vec<_>>();
    set_configured_plugins(config, next_enabled)?;
    write_toml_config(config_path, config)?;
    Ok(selected)
}

// Handles direct-binary plugin inspection and enabled-list mutations.
fn plugin_cli() {
    let runtime = default_runtime_config();
    let config_path = runtime.config_path;
    if cli_has_flag(&["--plugin-path"]) {
        print_cli_text(&format!("{}\n", plugin_directory(&config_path).display()));
        return;
    }

    let config = match read_toml_config_or_empty(&config_path) {
        Ok(config) => config,
        Err(error) => {
            print_cli_error(&format!("fpasoterm: {error}\n"));
            std::process::exit(2);
        }
    };
    let enabled = configured_plugins(&config);
    let plugin_uninstall = cli_option_values_any(&["--plugin-uninstall"]);
    if !plugin_uninstall.is_empty() {
        let mut updated = config;
        match uninstall_local_plugins_cli(&config_path, &mut updated, &enabled, &plugin_uninstall) {
            Ok(removed) => {
                for plugin in removed {
                    print_cli_text(&format!("uninstalled local plugin {plugin}\n"));
                }
                print_cli_text(&format!("updated {config_path}\n"));
                print_cli_text(
                    "Restart fpasoterm to unload the removed plugin from open windows.\n",
                );
            }
            Err(error) => {
                print_cli_error(&format!("fpasoterm: {error}\n"));
                std::process::exit(2);
            }
        }
        return;
    }
    let public_ports = cli_option_values_any(&["--plugin-install"]);
    let local_files = cli_option_values_any(&["--plugin-install-file"]);
    if !public_ports.is_empty() || !local_files.is_empty() {
        let force = cli_has_flag(&["--force"]);
        let enable = cli_has_flag(&["--enable"]);
        let mut installed = Vec::new();
        let selectors = if !public_ports.is_empty() {
            &public_ports
        } else {
            &local_files
        };
        for selector in selectors
            .iter()
            .flat_map(|value| value.split(','))
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let result =
                if !public_ports.is_empty() && cli_option_value("--plugin-ports-dir").is_some() {
                    install_local_plugin_port(
                        &config_path,
                        selector,
                        cli_option_value("--plugin-ports-dir"),
                        force,
                    )
                } else if !public_ports.is_empty() {
                    install_public_plugin_port(&config_path, selector, force)
                } else {
                    install_local_plugin_file(&config_path, selector, force)
                };
            match result {
                Ok(plugin) => {
                    print_cli_text(&format!("installed plugin {selector} -> {plugin}\n"));
                    installed.push(plugin);
                }
                Err(error) => {
                    print_cli_error(&format!("fpasoterm: {error}\n"));
                    std::process::exit(1);
                }
            }
        }
        if enable {
            let mut next_enabled = enabled;
            next_enabled.extend(installed.iter().cloned());
            next_enabled.sort();
            next_enabled.dedup();
            let mut updated = config;
            if let Err(error) =
                set_configured_plugins(&mut updated, next_enabled.clone()).and_then(|_| {
                    if let Some(parent) = Path::new(&config_path).parent() {
                        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
                    }
                    write_toml_config(&config_path, &updated)
                })
            {
                print_cli_error(&format!("fpasoterm: {error}\n"));
                std::process::exit(2);
            }
            print_cli_text(&format!(
                "enabled {} installed plugin(s) in {config_path}\n",
                installed.len()
            ));
            print_cli_text("Restart fpasoterm to load the installed plugin selection.\n");
        } else {
            print_cli_text("Review the installed source, then enable it with fpasoterm --plugin-enable <file>.\n");
        }
        return;
    }
    if cli_has_flag(&["--plugin-list"]) {
        print_plugin_list_cli(&config_path, &enabled);
        return;
    }

    if let Some(selector) = cli_option_value("--plugin-info") {
        let available = discover_plugin_files(&config_path);
        match resolve_plugin_selector(&selector, &available, "inspect") {
            Ok(plugin) => {
                let source_path = Path::new(&config_path)
                    .parent()
                    .unwrap_or_else(|| Path::new("."))
                    .join(&plugin);
                let source = fs::read_to_string(&source_path).unwrap_or_default();
                let metadata = plugin_metadata(&source);
                let extension = source_path.extension().and_then(|value| value.to_str());
                print_cli_text(&format!(
                    "Plugin: {plugin}\nState: {}\nType: {}\nVersion: {}\nSource: {}\nDescription: {}\nLoad status: loadable\n",
                    if enabled.contains(&plugin) { "enabled" } else { "disabled" },
                    if extension == Some("ts") { "TypeScript" } else { "JavaScript" },
                    metadata.version,
                    source_path.display(),
                    metadata.description,
                ));
            }
            Err(error) => {
                print_cli_error(&format!("fpasoterm: {error}\n"));
                std::process::exit(2);
            }
        }
        return;
    }

    let mut next_enabled = enabled;
    let available = discover_plugin_files(&config_path);
    if cli_has_flag(&["--plugin-enable-all"]) {
        if available.is_empty() {
            print_cli_error(&format!(
                "fpasoterm: no .js/.ts plugins found in {}\nCopy a trusted plugin there, then run --plugin-enable-all again.\n",
                plugin_directory(&config_path).display()
            ));
            std::process::exit(1);
        }
        next_enabled.extend(available.iter().cloned());
    }
    if cli_has_flag(&["--plugin-disable-all"]) {
        next_enabled.clear();
    }
    for (selectors, enabling) in [
        (
            cli_option_values_any(&["--enable-plugin", "--plugin-enable"]),
            true,
        ),
        (
            cli_option_values_any(&["--disable-plugin", "--plugin-disable"]),
            false,
        ),
    ] {
        for selector in selectors {
            for name in selector
                .split(',')
                .map(str::trim)
                .filter(|name| !name.is_empty())
            {
                let candidates = if enabling { &available } else { &next_enabled };
                let plugin = match resolve_plugin_selector(
                    name,
                    candidates,
                    if enabling { "enable" } else { "disable" },
                ) {
                    Ok(plugin) => plugin,
                    Err(error) => {
                        print_cli_error(&format!("fpasoterm: {error}\n"));
                        std::process::exit(2);
                    }
                };
                if enabling {
                    next_enabled.push(plugin);
                } else {
                    next_enabled.retain(|entry| entry != &plugin);
                }
            }
        }
    }
    next_enabled.sort();
    next_enabled.dedup();
    let mut updated = config;
    if let Err(error) = set_configured_plugins(&mut updated, next_enabled.clone()).and_then(|_| {
        if let Some(parent) = Path::new(&config_path).parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        write_toml_config(&config_path, &updated)
    }) {
        print_cli_error(&format!("fpasoterm: {error}\n"));
        std::process::exit(2);
    }
    print_cli_text(&format!("updated {config_path}\n"));
    print_plugin_list_cli(&config_path, &next_enabled);
    print_cli_text("Restart fpasoterm to load the updated plugin selection.\n");
}

// Returns true when any direct-binary plugin-management option was supplied.
fn plugin_cli_requested() -> bool {
    cli_has_flag(&[
        "--plugin-list",
        "--plugin-path",
        "--plugin-enable-all",
        "--plugin-disable-all",
        "--plugin-install",
        "--plugin-install-file",
        "--force",
        "--enable",
    ]) || !cli_option_values_any(&[
        "--plugin-info",
        "--plugin-uninstall",
        "--enable-plugin",
        "--disable-plugin",
        "--plugin-enable",
        "--plugin-disable",
        "--plugin-install",
        "--plugin-install-file",
    ])
    .is_empty()
}

// Looks up a dotted TOML path without requiring a typed deserialization model.
fn toml_value_at<'a>(value: &'a toml::Value, path: &str) -> Option<&'a toml::Value> {
    path.split('.')
        .try_fold(value, |current, key| current.get(key))
}

// Formats static runtime details as Markdown suitable for a GitHub Issue body.
fn diagnostics_markdown_cli() -> String {
    let runtime = runtime_config();
    let config_status = read_toml_config_or_empty(&runtime.config_path)
        .map(|_| "ok".to_string())
        .unwrap_or_else(|_| "error".to_string());
    let plugins = runtime
        .config
        .plugins
        .get("enabled")
        .and_then(serde_json::Value::as_array)
        .map(|plugins| {
            plugins
                .iter()
                .filter_map(serde_json::Value::as_str)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|plugins| !plugins.is_empty())
        .unwrap_or_else(|| "(none enabled)".to_string());
    let sync_enabled = runtime
        .config
        .sync
        .get("enabled")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    let logging_enabled = runtime
        .config
        .logging
        .get("enabled")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true);
    format!(
        "## fpasoterm diagnostics\n\n- version: fpasoterm {}\n- platform: {} {}\n- webview: Tauri WebView (direct binary)\n- config path: {}\n- config status: {}\n- profile: {}\n- plugins: {}\n- terminal size: {}x{} (configured)\n- terminal font size: {}\n- logging: {} ({})\n- sync: {}\n- debug log: {}\n",
        app_version(),
        env::consts::OS,
        env::consts::ARCH,
        runtime.config_path,
        config_status,
        if runtime.active_profile.is_empty() { "(none)" } else { &runtime.active_profile },
        plugins,
        runtime.config.window.width,
        runtime.config.window.height,
        runtime.config.terminal.get("fontSize").and_then(serde_json::Value::as_f64).unwrap_or(14.0),
        if logging_enabled { "enabled" } else { "disabled" },
        terminal_log_directory().display(),
        if sync_enabled { "enabled" } else { "disabled" },
        PathBuf::from(runtime.config_dir).join("logs").join("fpasoterm-debug.log").display(),
    )
}

// Opens the configured terminal-log directory in the operating system file manager.
fn open_log_directory_cli() {
    let directory = terminal_log_directory();
    if let Err(error) = fs::create_dir_all(&directory) {
        print_cli_error(&format!(
            "fpasoterm: failed to create {}: {error}\n",
            directory.display()
        ));
        std::process::exit(2);
    }
    #[cfg(target_os = "windows")]
    let result = Command::new("explorer.exe").arg(&directory).spawn();
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(&directory).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(&directory).spawn();
    match result {
        Ok(_) => print_cli_text(&format!("{}\n", directory.display())),
        Err(error) => {
            print_cli_error(&format!(
                "fpasoterm: could not open {}: {error}\n",
                directory.display()
            ));
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

// Renames the selected config, restores defaults, and clears remembered bounds.
fn reset_config_cli() {
    let runtime = default_runtime_config();
    let path = runtime.config_path;
    let state_path = runtime.window_state_path;
    let path_ref = std::path::Path::new(&path);
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let backup_path = format!("{path}.backup-{timestamp}");

    let result = (|| -> Result<bool, String> {
        if let Some(parent) = path_ref.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
        }
        let backed_up = path_ref.exists();
        if backed_up {
            fs::rename(path_ref, &backup_path)
                .map_err(|error| format!("failed to rename {path}: {error}"))?;
        }
        fs::write(path_ref, embedded_default_config_toml())
            .map_err(|error| format!("failed to write {path}: {error}"))?;
        match fs::remove_file(&state_path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("failed to delete {state_path}: {error}")),
        }
        Ok(backed_up)
    })();

    match result {
        Ok(backed_up) => {
            print_cli_text(&format!("reset config {path}\n"));
            if backed_up {
                print_cli_text(&format!("renamed previous config {backup_path}\n"));
            }
            print_cli_text(&format!("deleted saved window state {state_path}\n"));
        }
        Err(error) => {
            print_cli_error(&format!("fpasoterm: {error}\n"));
            std::process::exit(2);
        }
    }
}

// Adds defaults introduced by newer releases while keeping existing values.
fn update_config_cli() {
    let runtime = default_runtime_config();
    let path = runtime.config_path;
    let result = (|| -> Result<(usize, Option<String>), String> {
        let defaults: toml::Value = toml::from_str(&embedded_default_config_toml())
            .map_err(|error| format!("failed to read default config: {error}"))?;
        let existing = read_toml_config_or_empty(&path)?;
        let missing = missing_toml_keys(&defaults, Some(&existing), "");
        if missing.is_empty() {
            return Ok((0, None));
        }
        let backup_path = backup_config_file(&path)?;
        let mut merged = defaults;
        merge_toml_value(&mut merged, existing);
        write_toml_config(&path, &merged)?;
        Ok((missing.len(), backup_path))
    })();

    match result {
        Ok((0, _)) => print_cli_text(&format!("config already includes all defaults: {path}\n")),
        Ok((count, backup)) => {
            print_cli_text(&format!(
                "updated {path}\nadded {count} default setting(s)\n"
            ));
            if let Some(backup) = backup {
                print_cli_text(&format!("backed up previous config {backup}\n"));
            }
        }
        Err(error) => {
            print_cli_error(&format!("fpasoterm: {error}\n"));
            std::process::exit(2);
        }
    }
}

// Removes configuration keys that are absent from the current default schema.
fn prune_config_cli() {
    let runtime = default_runtime_config();
    let path = runtime.config_path;
    if !Path::new(&path).exists() {
        print_cli_text(&format!("config does not exist: {path}\n"));
        return;
    }
    let result = (|| -> Result<(Vec<String>, String), String> {
        let defaults: toml::Value = toml::from_str(&embedded_default_config_toml())
            .map_err(|error| format!("failed to read default config: {error}"))?;
        let mut existing = read_toml_config_or_empty(&path)?;
        let mut removed = Vec::new();
        prune_toml_value(&defaults, &mut existing, "", &mut removed);
        if removed.is_empty() {
            return Ok((removed, String::new()));
        }
        let backup = backup_config_file(&path)?.unwrap_or_default();
        write_toml_config(&path, &existing)?;
        Ok((removed, backup))
    })();

    match result {
        Ok((removed, _)) if removed.is_empty() => {
            print_cli_text(&format!("config has no unsupported settings: {path}\n"));
        }
        Ok((removed, backup)) => {
            print_cli_text(&format!(
                "pruned {path}\nremoved {} unsupported setting(s): {}\nbacked up previous config {backup}\n",
                removed.len(),
                removed.join(", ")
            ));
        }
        Err(error) => {
            print_cli_error(&format!("fpasoterm: {error}\n"));
            std::process::exit(2);
        }
    }
}

// Refreshes the complete example when the direct packaged binary is launched.
fn refresh_config_example(config_path: &str) {
    let example_path = format!("{config_path}.example");
    let default_text = embedded_default_config_toml();
    let needs_update = fs::read_to_string(&example_path)
        .map(|existing| existing != default_text)
        .unwrap_or(true);
    if !needs_update {
        return;
    }
    if let Some(parent) = Path::new(&example_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(example_path, default_text);
}

// Reads absent configurations as an empty table so --update-config can create one.
fn read_toml_config_or_empty(path: &str) -> Result<toml::Value, String> {
    if !Path::new(path).exists() {
        return Ok(toml::Value::Table(toml::map::Map::new()));
    }
    let text =
        fs::read_to_string(path).map_err(|error| format!("failed to read {path}: {error}"))?;
    toml::from_str(&text).map_err(|error| format!("failed to parse {path}: {error}"))
}

// Creates a same-directory backup before a configuration rewrite.
fn backup_config_file(path: &str) -> Result<Option<String>, String> {
    let path_ref = Path::new(path);
    if let Some(parent) = path_ref.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    if !path_ref.exists() {
        return Ok(None);
    }
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let backup = format!("{path}.backup-{timestamp}");
    fs::copy(path_ref, &backup).map_err(|error| format!("failed to back up {path}: {error}"))?;
    Ok(Some(backup))
}

// Writes normalized TOML with the standard fpasoterm file header.
fn write_toml_config(path: &str, value: &toml::Value) -> Result<(), String> {
    let text =
        toml::to_string(value).map_err(|error| format!("failed to serialize config: {error}"))?;
    fs::write(path, format!("# fpasoterm user configuration.\n{text}"))
        .map_err(|error| format!("failed to write {path}: {error}"))
}

// Recursively overlays TOML scalar/array values and preserves nested tables.
fn merge_toml_value(base: &mut toml::Value, override_value: toml::Value) {
    match (base, override_value) {
        (toml::Value::Table(base_table), toml::Value::Table(override_table)) => {
            for (key, value) in override_table {
                match base_table.get_mut(&key) {
                    Some(base_value) => merge_toml_value(base_value, value),
                    None => {
                        base_table.insert(key, value);
                    }
                }
            }
        }
        (base_value, value) => *base_value = value,
    }
}

// Counts missing default leaf values for --update-config output.
fn missing_toml_keys(
    defaults: &toml::Value,
    existing: Option<&toml::Value>,
    prefix: &str,
) -> Vec<String> {
    let mut missing = Vec::new();
    if let toml::Value::Table(default_table) = defaults {
        let existing_table = existing.and_then(toml::Value::as_table);
        for (key, default_value) in default_table {
            let path = if prefix.is_empty() {
                key.clone()
            } else {
                format!("{prefix}.{key}")
            };
            let configured = existing_table.and_then(|table| table.get(key));
            if default_value.is_table() {
                missing.extend(missing_toml_keys(default_value, configured, &path));
            } else if configured.is_none() {
                missing.push(path);
            }
        }
    }
    missing
}

// Prunes unsupported TOML table entries while retaining supported values.
fn prune_toml_value(
    defaults: &toml::Value,
    config: &mut toml::Value,
    prefix: &str,
    removed: &mut Vec<String>,
) {
    let (toml::Value::Table(default_table), toml::Value::Table(config_table)) = (defaults, config)
    else {
        return;
    };
    let keys = config_table.keys().cloned().collect::<Vec<_>>();
    for key in keys {
        let path = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}.{key}")
        };
        // Profiles are named user-owned overlays. Validate the selected one at
        // launch time, but never remove all profiles as unsupported keys.
        if prefix.is_empty() && key == "profiles" {
            continue;
        }
        let Some(default_value) = default_table.get(&key) else {
            config_table.remove(&key);
            removed.push(path);
            continue;
        };
        if let Some(config_value) = config_table.get_mut(&key) {
            prune_toml_value(default_value, config_value, &path, removed);
        }
    }
}

// Returns the packaged default TOML with platform-specific terminal font defaults.
fn embedded_default_config_toml() -> String {
    default_config_toml_for_terminal_defaults(
        default_terminal_font_size(),
        default_terminal_font_family(),
        default_terminal_line_height(),
    )
}

// Produces deterministic default TOML for runtime use and unit tests.
fn default_config_toml_for_terminal_defaults(
    font_size: u32,
    font_family: &str,
    line_height: f64,
) -> String {
    let text = include_str!("../default-config.toml").replacen(
        "fontSize = 14",
        &format!("fontSize = {font_size}"),
        1,
    );
    let text = text.replacen("lineHeight = 1", &format!("lineHeight = {line_height}"), 1);
    let font_family_line = format!(
        "fontFamily = {}",
        toml::Value::String(font_family.to_string())
    );
    let mut replaced_font_family = false;
    let mut result = text
        .lines()
        .map(|line| {
            if !replaced_font_family && line.starts_with("fontFamily = ") {
                replaced_font_family = true;
                font_family_line.clone()
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    result.push('\n');
    result
}

// Writes CLI errors through the same console-aware path used for normal output.
fn print_cli_error(text: &str) {
    print_cli_text(text);
}

#[cfg(windows)]
// Attaches to the parent console because release builds use windows_subsystem="windows".
// Detaching again after the write lets PowerShell redraw its prompt immediately.
fn print_cli_text_windows(text: &str) {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileA, WriteFile, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows_sys::Win32::System::Console::{AttachConsole, FreeConsole, ATTACH_PARENT_PROCESS};

    const GENERIC_WRITE: u32 = 0x4000_0000;

    unsafe {
        let attached_parent_console = AttachConsole(ATTACH_PARENT_PROCESS) != 0;
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
            if attached_parent_console {
                FreeConsole();
            }
            return;
        }
        if attached_parent_console {
            FreeConsole();
        }
    }

    let mut stdout = std::io::stdout().lock();
    let _ = stdout.write_all(text.as_bytes());
    let _ = stdout.flush();
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
    let diagnostics_file = PathBuf::from(runtime_config().config_dir)
        .join("logs")
        .join("fpasoterm-debug.log");
    if let Some(parent) = diagnostics_file.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&diagnostics_file)
    {
        let _ = writeln!(file, "{line}");
    }
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

#[cfg(target_os = "macos")]
// Restores the conventional user CLI path and keeps the config shim for compatibility.
fn terminal_path_with_app_dir() -> Option<String> {
    let executable = env::current_exe().ok()?;
    let app_dir = executable.parent()?.to_path_buf();
    let local_bin_dir = PathBuf::from(home_dir()).join(".local").join("bin");
    let config_bin_dir = PathBuf::from(home_dir())
        .join(".config")
        .join("fpasoterm")
        .join("bin");
    let local_shim = local_bin_dir.join("fpasoterm");
    if write_macos_cli_shim(&local_shim, &executable).is_err() {
        return joined_terminal_path(vec![app_dir]);
    }
    let _ = write_macos_cli_shim(&config_bin_dir.join("fpasoterm"), &executable);
    joined_terminal_path(vec![local_bin_dir, config_bin_dir, app_dir])
}

#[cfg(target_os = "macos")]
// Writes an executable shell shim that forwards argv to the current app binary.
fn write_macos_cli_shim(path: &Path, executable: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let parent = path
        .parent()
        .ok_or_else(|| "macOS CLI shim has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
    let quoted_executable = shell_single_quote(&executable.to_string_lossy());
    fs::write(
        &temporary,
        format!("#!/bin/sh\nexec {quoted_executable} \"$@\"\n"),
    )
    .map_err(|error| error.to_string())?;
    fs::set_permissions(&temporary, fs::Permissions::from_mode(0o755))
        .map_err(|error| error.to_string())?;
    let _ = fs::remove_file(path);
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
// Quotes one path for a POSIX shell without evaluating its contents.
fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

#[cfg(target_os = "macos")]
// Joins prepended directories with the inherited process PATH.
fn joined_terminal_path(mut paths: Vec<PathBuf>) -> Option<String> {
    let existing_path = env::var_os("PATH").unwrap_or_default();
    paths.extend(env::split_paths(&existing_path));
    env::join_paths(paths)
        .ok()
        .map(|value| value.to_string_lossy().to_string())
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn terminal_path_with_app_dir() -> Option<String> {
    None
}

impl TerminalOutputDecoder {
    // Creates a streaming decoder for the selected PTY output encoding.
    fn new(encoding: TerminalEncoding) -> Self {
        Self {
            pending: Vec::new(),
            jis_x0201_kana: false,
            legacy_decoder: match encoding {
                TerminalEncoding::Utf8 => None,
                TerminalEncoding::ShiftJis => Some(SHIFT_JIS.new_decoder_without_bom_handling()),
                TerminalEncoding::EucJp => Some(EUC_JP.new_decoder_without_bom_handling()),
            },
        }
    }

    // Converts PTY bytes to Unicode text for xterm.js.
    fn decode(&mut self, bytes: &[u8]) -> String {
        if let Some(decoder) = self.legacy_decoder.as_mut() {
            let mut result = String::with_capacity(bytes.len());
            // Keep replacement characters visible rather than silently changing bytes.
            // This tells the user that a different decoder may be needed.
            let (_, _, _had_errors) = decoder.decode_to_string(bytes, &mut result, false);
            return result;
        }

        let mut input = Vec::with_capacity(self.pending.len() + bytes.len());
        input.append(&mut self.pending);
        input.extend_from_slice(bytes);

        let mut result = String::new();
        let mut index = 0;
        while index < input.len() {
            let byte = input[index];

            if byte == 0x1b {
                if index + 2 >= input.len() {
                    self.pending.extend_from_slice(&input[index..]);
                    break;
                }
                if input[index + 1] == b'(' {
                    match input[index + 2] {
                        b'I' => {
                            self.jis_x0201_kana = true;
                            index += 3;
                            continue;
                        }
                        b'B' | b'J' => {
                            self.jis_x0201_kana = false;
                            index += 3;
                            continue;
                        }
                        _ => {}
                    }
                }
                result.push('\x1b');
                index += 1;
                continue;
            }

            if byte == 0x9b {
                result.push_str("\x1b[");
                index += 1;
                continue;
            }

            if self.jis_x0201_kana && (0x21..=0x5f).contains(&byte) {
                result.push(jis_x0201_half_width_kana(byte - 0x21));
                index += 1;
                continue;
            }

            if byte < 0x80 {
                result.push(byte as char);
                index += 1;
                continue;
            }

            let width = utf8_sequence_width(byte);
            if width > 0 && index + width > input.len() {
                self.pending.extend_from_slice(&input[index..]);
                break;
            }
            if width > 0 {
                match std::str::from_utf8(&input[index..index + width]) {
                    Ok(text) => {
                        result.push_str(text);
                        index += width;
                        continue;
                    }
                    Err(_) => {}
                }
            }

            if (0xa1..=0xdf).contains(&byte) {
                result.push(jis_x0201_half_width_kana(byte - 0xa1));
            } else {
                result.push('\u{fffd}');
            }
            index += 1;
        }

        result
    }
}

impl TerminalTextNormalizer {
    // Creates a normalizer that keeps cursor position across log chunks.
    fn new() -> Self {
        Self {
            pending: String::new(),
            row: 1,
            column: 1,
        }
    }

    // Converts terminal control sequences to readable line breaks and spacing.
    fn normalize(&mut self, text: &str) -> String {
        let input = format!("{}{}", self.pending, text);
        self.pending.clear();
        let chars: Vec<char> = input.chars().collect();
        let mut result = String::new();
        let mut index = 0;

        while index < chars.len() {
            let character = chars[index];
            if character == '\x1b' {
                match self.consume_escape_sequence(&chars, index, &mut result) {
                    Some(next_index) => index = next_index,
                    None => {
                        self.pending = chars[index..].iter().collect();
                        break;
                    }
                }
                continue;
            }

            self.push_plain_character(&mut result, character);
            index += 1;
        }

        result
    }

    // Handles a complete ESC sequence, returning the next character index.
    fn consume_escape_sequence(
        &mut self,
        chars: &[char],
        index: usize,
        result: &mut String,
    ) -> Option<usize> {
        let introducer = *chars.get(index + 1)?;
        match introducer {
            '[' => {
                let mut parameters = String::new();
                let mut cursor = index + 2;
                while cursor < chars.len() {
                    let character = chars[cursor];
                    if ('@'..='~').contains(&character) {
                        self.apply_csi(result, &parameters, character);
                        return Some(cursor + 1);
                    }
                    parameters.push(character);
                    cursor += 1;
                }
                None
            }
            ']' => {
                let mut cursor = index + 2;
                let mut previous_was_escape = false;
                while cursor < chars.len() {
                    let character = chars[cursor];
                    if character == '\x07' {
                        return Some(cursor + 1);
                    }
                    if previous_was_escape && character == '\\' {
                        return Some(cursor + 1);
                    }
                    previous_was_escape = character == '\x1b';
                    cursor += 1;
                }
                None
            }
            '(' | ')' | '*' | '+' => {
                if index + 2 < chars.len() {
                    Some(index + 3)
                } else {
                    None
                }
            }
            _ => Some((index + 2).min(chars.len())),
        }
    }

    // Applies CSI layout commands to the plain-text log position.
    fn apply_csi(&mut self, result: &mut String, parameters: &str, final_character: char) {
        match final_character {
            'C' => self.push_spaces(result, first_csi_numeric_parameter(parameters, 1)),
            'G' => {
                let column = first_csi_numeric_parameter(parameters, 1).max(1);
                if column > self.column {
                    self.push_spaces(result, column - self.column);
                }
                self.column = column;
            }
            'H' | 'f' => {
                let (row, column) = first_two_csi_numeric_parameters(parameters, 1, 1);
                self.move_cursor(result, row.max(1), column.max(1));
            }
            'B' | 'E' => self.push_newlines(result, first_csi_numeric_parameter(parameters, 1)),
            _ => {}
        }
    }

    // Moves the tracked cursor, preserving readable lines for downward movement.
    fn move_cursor(&mut self, result: &mut String, row: usize, column: usize) {
        if row > self.row {
            self.push_newlines(result, row - self.row);
        }
        if row == self.row && column > self.column {
            self.push_spaces(result, column - self.column);
        }
        self.row = row;
        self.column = column;
    }

    // Writes a normal character or terminal newline into the output.
    fn push_plain_character(&mut self, result: &mut String, character: char) {
        match character {
            '\r' | '\n' => self.push_newlines(result, 1),
            '\t' => {
                result.push('\t');
                self.column += 1;
            }
            '\x08' => {
                result.pop();
                self.column = self.column.saturating_sub(1).max(1);
            }
            '\x00'..='\x1f' | '\x7f' => {}
            '\u{3099}' | '\u{309a}' => {
                if let Some(composed) = compose_japanese_voicing(result.pop(), character) {
                    result.push(composed);
                }
            }
            _ => {
                result.push(character);
                self.column += 1;
            }
        }
    }

    // Adds collapsed line breaks while updating the tracked cursor.
    fn push_newlines(&mut self, result: &mut String, count: usize) {
        let count = count.clamp(1, 24);
        for _ in 0..count {
            if !result.ends_with('\n') {
                result.push('\n');
            }
            self.row += 1;
            self.column = 1;
        }
    }

    // Adds bounded spaces for cursor-forward movement.
    fn push_spaces(&mut self, result: &mut String, count: usize) {
        let count = count.clamp(1, 120);
        result.push_str(&" ".repeat(count));
        self.column += count;
    }
}

// Maps JIS X 0201 half-width kana indexes to Unicode half-width kana code points.
fn jis_x0201_half_width_kana(index: u8) -> char {
    char::from_u32(0xff61 + u32::from(index)).unwrap_or('\u{fffd}')
}

// Composes decomposed Japanese kana voicing marks so xterm.js and logs show one glyph.
fn compose_japanese_voicing(base: Option<char>, mark: char) -> Option<char> {
    let base = base?;
    match (base, mark) {
        ('ウ', '\u{3099}') => Some('ヴ'),
        ('カ', '\u{3099}') => Some('ガ'),
        ('キ', '\u{3099}') => Some('ギ'),
        ('ク', '\u{3099}') => Some('グ'),
        ('ケ', '\u{3099}') => Some('ゲ'),
        ('コ', '\u{3099}') => Some('ゴ'),
        ('サ', '\u{3099}') => Some('ザ'),
        ('シ', '\u{3099}') => Some('ジ'),
        ('ス', '\u{3099}') => Some('ズ'),
        ('セ', '\u{3099}') => Some('ゼ'),
        ('ソ', '\u{3099}') => Some('ゾ'),
        ('タ', '\u{3099}') => Some('ダ'),
        ('チ', '\u{3099}') => Some('ヂ'),
        ('ツ', '\u{3099}') => Some('ヅ'),
        ('テ', '\u{3099}') => Some('デ'),
        ('ト', '\u{3099}') => Some('ド'),
        ('ハ', '\u{3099}') => Some('バ'),
        ('ヒ', '\u{3099}') => Some('ビ'),
        ('フ', '\u{3099}') => Some('ブ'),
        ('ヘ', '\u{3099}') => Some('ベ'),
        ('ホ', '\u{3099}') => Some('ボ'),
        ('ハ', '\u{309a}') => Some('パ'),
        ('ヒ', '\u{309a}') => Some('ピ'),
        ('フ', '\u{309a}') => Some('プ'),
        ('ヘ', '\u{309a}') => Some('ペ'),
        ('ホ', '\u{309a}') => Some('ポ'),
        _ => Some(base),
    }
}

// Returns the expected byte width for a UTF-8 leading byte.
fn utf8_sequence_width(byte: u8) -> usize {
    match byte {
        0xc2..=0xdf => 2,
        0xe0..=0xef => 3,
        0xf0..=0xf4 => 4,
        _ => 0,
    }
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
            pixel_width: size.pixel_width,
            pixel_height: size.pixel_height,
        })
        .map_err(|error| error.to_string())?;

    let config = runtime_config();
    let output_encoding = terminal_output_encoding(&config.config);
    let shell = shell_command(&config.config);
    append_diagnostic(
        &app,
        &format!(
            "terminal_start shell={} cols={} rows={} pixel_width={} pixel_height={}",
            shell, size.cols, size.rows, size.pixel_width, size.pixel_height
        ),
    );
    let mut command = CommandBuilder::new(&shell);
    if !cfg!(windows) {
        command.arg("-i");
    }
    let start_directory = env::var("FPASOTERM_START_CWD")
        .ok()
        .and_then(|value| validated_start_directory(&value, None).ok())
        .unwrap_or_else(|| PathBuf::from(home_dir()));
    command.cwd(&start_directory);
    command.env("TERM", "xterm-256color");
    // xterm.js renders 24-bit ANSI colors. Advertise that separately from the
    // xterm-256color terminfo entry so TUI applications choose their truecolor path.
    command.env("COLORTERM", "truecolor");
    command.env("TERM_PROGRAM", "fpasoterm");
    configure_osc7_shell_integration(&mut command, &shell);
    configure_utf8_terminal_locale(&mut command, output_encoding);
    if let Some(path_value) = terminal_path_with_app_dir() {
        if cfg!(windows) {
            command.env("Path", path_value);
        } else {
            command.env("PATH", path_value);
        }
    }

    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    let shell_pid = child.process_id();
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
        let mut decoder = TerminalOutputDecoder::new(output_encoding);
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    if console_diagnostics_enabled() {
                        eprintln!("terminal_read bytes={read}");
                    }
                    append_terminal_log(&terminal_log, &buffer[..read]);
                    let data = decoder.decode(&buffer[..read]);
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
        shell_pid,
    });
    drop(terminal);
    start_terminal_broadcast_listener(app, state.inner());
    Ok(())
}

// Adds a Bash prompt hook so the renderer can learn the local directory through
// OSC 7. Other shells may provide their own OSC 7 shell integration unchanged.
fn configure_osc7_shell_integration(command: &mut CommandBuilder, shell: &str) {
    let is_bash = Path::new(shell)
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            name.eq_ignore_ascii_case("bash") || name.eq_ignore_ascii_case("bash.exe")
        });
    if !is_bash {
        return;
    }
    // This hook is injected only into a locally-started Bash. Use the stable
    // localhost spelling instead of $HOSTNAME because ChromeOS containers can
    // expose different host names to the shell and Tauri process.
    let report = r#"printf '\033]7;file://localhost%s\007' "$PWD""#;
    let prompt_command = env::var("PROMPT_COMMAND")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(|value| format!("{value}; {report}"))
        .unwrap_or_else(|| report.to_string());
    command.env("PROMPT_COMMAND", prompt_command);
}

#[tauri::command]
// Writes renderer keyboard/input data into the active PTY.
fn terminal_write(state: State<AppState>, data: String) -> Result<(), String> {
    write_terminal_input(&state.terminal, &data)
}

#[tauri::command]
// Reports the environment that fpasoterm provides to its PTY and documents the
// renderer-mediated terminal capabilities exposed by the diagnostics panel.
fn terminal_capabilities() -> serde_json::Value {
    let locale = env::var("LC_ALL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            env::var("LC_CTYPE")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
        .or_else(|| {
            env::var("LANG")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
        .unwrap_or_else(|| "(not set)".to_string());
    let config = runtime_config();
    let encoding = terminal_encoding_name(terminal_output_encoding(&config.config));
    serde_json::json!({
        "term": "xterm-256color",
        "colorterm": "truecolor",
        "locale": locale,
        "encoding": encoding,
        "shell": shell_command(&config.config),
    })
}

#[tauri::command]
// Terminates the foreground terminal job while preserving the interactive shell.
fn terminal_kill(state: State<AppState>) -> Result<(), String> {
    #[cfg(unix)]
    {
        let terminal = state.terminal.lock().map_err(|error| error.to_string())?;
        let session = terminal
            .as_ref()
            .ok_or_else(|| "terminal is not running".to_string())?;
        let foreground_group = session
            .master
            .process_group_leader()
            .ok_or_else(|| "could not identify the foreground terminal process".to_string())?;
        if session.shell_pid == Some(foreground_group as u32) {
            return Err(
                "no foreground command is running; use the window close button to exit the shell"
                    .to_string(),
            );
        }
        // Negative PID signals every process in the foreground job's process group.
        let result = unsafe { libc::kill(-foreground_group, libc::SIGKILL) };
        if result == 0 {
            return Ok(());
        }
        return Err(std::io::Error::last_os_error().to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let terminal = state.terminal.lock().map_err(|error| error.to_string())?;
        let session = terminal
            .as_ref()
            .ok_or_else(|| "terminal is not running".to_string())?;
        let shell_pid = session
            .shell_pid
            .ok_or_else(|| "could not identify the terminal shell process".to_string())?;
        return kill_windows_shell_descendants(shell_pid);
    }

    #[cfg(all(not(unix), not(target_os = "windows")))]
    {
        let _ = state;
        Err("Kill is not available on this platform; use Ctrl+C or close the window".to_string())
    }
}

#[cfg(target_os = "windows")]
// Terminates all descendants of the terminal shell while leaving the shell alive.
fn kill_windows_shell_descendants(shell_pid: u32) -> Result<(), String> {
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return Err(std::io::Error::last_os_error().to_string());
    }

    let mut parent_pairs = Vec::new();
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    unsafe {
        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                parent_pairs.push((entry.th32ParentProcessID, entry.th32ProcessID));
                entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }

    let mut descendants = Vec::new();
    let mut known = HashSet::from([shell_pid]);
    loop {
        let mut found = false;
        for (parent_pid, process_pid) in &parent_pairs {
            if known.contains(parent_pid) && known.insert(*process_pid) {
                descendants.push(*process_pid);
                found = true;
            }
        }
        if !found {
            break;
        }
    }
    if descendants.is_empty() {
        return Err("no command process is running under the terminal shell".to_string());
    }

    let mut terminated = 0;
    for process_pid in descendants.iter().rev() {
        unsafe {
            let process = OpenProcess(
                PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION,
                0,
                *process_pid,
            );
            if process == ptr::null_mut() {
                continue;
            }
            if TerminateProcess(process, 1) != 0 {
                terminated += 1;
            }
            let _ = CloseHandle(process);
        }
    }
    if terminated == 0 {
        return Err("could not terminate the active terminal command".to_string());
    }
    Ok(())
}

// Writes one input sequence to a local PTY without applying renderer IME filtering.
fn write_terminal_input(
    terminal_state: &Arc<Mutex<Option<TerminalSession>>>,
    data: &str,
) -> Result<(), String> {
    let terminal = terminal_state.lock().map_err(|error| error.to_string())?;
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
// Broadcasts one input sequence to every currently running local terminal and,
// when requested, to active terminals using the configured sync folder/channel.
fn terminal_broadcast(
    app: AppHandle,
    state: State<AppState>,
    request: TerminalBroadcastRequest,
) -> Result<TerminalBroadcastStatus, String> {
    let text = request.text;
    if text.is_empty() {
        return Err("broadcast text is empty".to_string());
    }
    let max_bytes = sync_max_bytes();
    if text.len() > max_bytes {
        return Err(format!(
            "broadcast payload is too large: {} bytes > {max_bytes} bytes",
            text.len()
        ));
    }

    let created_at = now_millis();
    let mut item = TerminalBroadcastItem {
        schema_version: 1,
        id: format!("{}-{created_at}", state.source_id),
        source_id: state.source_id.clone(),
        created_at,
        expires_at: created_at.saturating_add(sync_command_ttl_millis()),
        text,
        target_instance_ids: request.target_instance_ids,
        key_event: request.key_event,
        signature: None,
    };
    if request.include_sync {
        item.signature = Some(sign_terminal_broadcast_item(
            &item,
            &sync_command_key_material()?,
        )?);
    }
    write_terminal_broadcast_item(&local_broadcast_directory(), &item)?;
    if request.include_sync {
        let directory = sync_command_directory()?;
        write_terminal_broadcast_item(&directory, &item)?;
    }
    append_diagnostic(
        &app,
        &format!(
            "terminal broadcast requested id={} bytes={} synced={}",
            item.id,
            item.text.len(),
            request.include_sync
        ),
    );
    Ok(TerminalBroadcastStatus {
        id: item.id,
        include_sync: request.include_sync,
        message: if request.include_sync {
            "broadcast input sent to local windows and synced channel".to_string()
        } else {
            "broadcast input sent to local windows".to_string()
        },
    })
}

// Sends a CLI command through the same short-lived JSON files used by the Broadcast dialog.
fn broadcast_terminal_input_cli() -> Result<String, String> {
    let raw_text =
        cli_option_value("--broadcast").ok_or_else(|| "--broadcast requires text".to_string())?;
    let normalized = raw_text.replace("\r\n", "\n").replace('\r', "\n");
    let text = format!(
        "{}\r",
        normalized.trim_end_matches('\n').replace('\n', "\r")
    );
    if text == "\r" {
        return Err("broadcast text is empty".to_string());
    }
    let max_bytes = sync_max_bytes();
    if text.len() > max_bytes {
        return Err(format!(
            "broadcast payload is too large: {} bytes > {max_bytes} bytes",
            text.len()
        ));
    }

    let all_targets = live_terminal_broadcast_targets();
    if all_targets.is_empty() {
        return Err("no running fpasoterm windows were found".to_string());
    }
    let selectors = cli_option_values_any(&["--broadcast-target"])
        .into_iter()
        .flat_map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    let selected_targets = if selectors.is_empty() {
        all_targets.clone()
    } else {
        let mut selected_ids = HashSet::new();
        for selector in selectors {
            let matching = all_targets.iter().filter(|target| {
                selector
                    .parse::<u32>()
                    .map(|pid| target.pid == pid)
                    .unwrap_or_else(|_| target.title == selector)
            });
            let mut matched = false;
            for target in matching {
                selected_ids.insert(target.id.clone());
                matched = true;
            }
            if !matched {
                return Err(format!(
                    "no running window matches Broadcast target {}",
                    serde_json::to_string(&selector).unwrap_or_else(|_| "<invalid>".to_string())
                ));
            }
        }
        all_targets
            .iter()
            .filter(|target| selected_ids.contains(&target.id))
            .cloned()
            .collect::<Vec<_>>()
    };
    let include_sync = cli_has_flag(&["--broadcast-sync"]);
    if include_sync && selected_targets.len() != all_targets.len() {
        return Err(
            "--broadcast-sync requires every running local window to be selected".to_string(),
        );
    }

    let created_at = now_millis();
    let mut item = TerminalBroadcastItem {
        schema_version: 1,
        id: format!("cli-{}-{created_at}", std::process::id()),
        source_id: format!("cli-{}", std::process::id()),
        created_at,
        expires_at: created_at.saturating_add(sync_command_ttl_millis()),
        text,
        target_instance_ids: selected_targets
            .iter()
            .map(|target| target.id.clone())
            .collect(),
        key_event: None,
        signature: None,
    };
    if include_sync {
        item.signature = Some(sign_terminal_broadcast_item(
            &item,
            &sync_command_key_material()?,
        )?);
    }
    write_terminal_broadcast_item(&local_broadcast_directory(), &item)?;
    if include_sync {
        write_terminal_broadcast_item(&sync_command_directory()?, &item)?;
    }
    Ok(format!(
        "broadcast: sent id={} local_targets={} synced={}\n",
        item.id,
        selected_targets.len(),
        include_sync
    ))
}

#[tauri::command]
// Lists live local terminal instances for the broadcast target selector.
fn terminal_broadcast_targets() -> Vec<TerminalBroadcastTarget> {
    live_terminal_broadcast_targets()
}

// Starts one lightweight watcher per application process after its PTY is ready.
fn start_terminal_broadcast_listener(app: AppHandle, state: &AppState) {
    if state
        .broadcast_listener_started
        .swap(true, Ordering::SeqCst)
    {
        return;
    }
    let terminal = Arc::clone(&state.terminal);
    let instance_id = state.source_id.clone();
    let started_at = state.started_at;
    std::thread::spawn(move || {
        let mut seen = HashSet::new();
        loop {
            let mut directories = vec![(local_broadcast_directory(), false)];
            if let Ok(directory) = sync_command_directory() {
                directories.push((directory, true));
            }
            for (directory, require_signature) in directories {
                for item in read_terminal_broadcast_items(&directory, started_at, require_signature)
                {
                    if !seen.insert(item.id.clone()) {
                        continue;
                    }
                    if !item.target_instance_ids.is_empty()
                        && !item
                            .target_instance_ids
                            .iter()
                            .any(|target| target == &instance_id)
                    {
                        continue;
                    }
                    match write_terminal_input(&terminal, &item.text) {
                        Ok(()) => {
                            if let Some(key_event) = item.key_event.as_ref() {
                                let _ = app.emit("terminal:broadcast-key", key_event);
                            }
                            append_diagnostic(
                                &app,
                                &format!(
                                    "terminal broadcast received id={} bytes={} key_event={} source={}",
                                    item.id,
                                    item.text.len(),
                                    item.key_event.is_some(),
                                    item.source_id
                                ),
                            );
                        }
                        Err(error) => append_diagnostic(
                            &app,
                            &format!("terminal broadcast write failed id={}: {error}", item.id),
                        ),
                    }
                }
            }
            if seen.len() > 512 {
                seen.clear();
            }
            std::thread::sleep(Duration::from_millis(350));
        }
    });
}

// Collects live marker records with the IDs used for precise local broadcast delivery.
fn live_terminal_broadcast_targets() -> Vec<TerminalBroadcastTarget> {
    let directory = cache_dir_path().join("instances");
    let mut targets = Vec::new();
    if let Ok(entries) = fs::read_dir(&directory) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("pid") {
                continue;
            }
            let Some(pid) = path
                .file_stem()
                .and_then(|value| value.to_str())
                .and_then(|value| value.parse::<u32>().ok())
            else {
                continue;
            };
            if !instance_marker_is_live(pid, &path) {
                let _ = fs::remove_file(path);
                continue;
            }
            let value: serde_json::Value = fs::read_to_string(&path)
                .ok()
                .and_then(|text| serde_json::from_str(&text).ok())
                .unwrap_or_default();
            let Some(id) = value
                .get("instanceId")
                .and_then(serde_json::Value::as_str)
                .filter(|id| !id.is_empty())
                .map(str::to_string)
            else {
                continue;
            };
            let title = value
                .get("title")
                .or_else(|| value.get("baseTitle"))
                .and_then(serde_json::Value::as_str)
                .unwrap_or("fpasoterm")
                .to_string();
            targets.push(TerminalBroadcastTarget { id, pid, title });
        }
    }
    targets.sort_by_key(|target| target.pid);
    targets
}

// Stores local broadcast requests outside sync folders so same-host windows work offline.
fn local_broadcast_directory() -> PathBuf {
    cache_dir_path().join("broadcast").join("commands")
}

// Uses a short expiry because input commands must never execute after a delayed restart.
fn sync_command_ttl_millis() -> u128 {
    sync_config()
        .get("commandTtlSeconds")
        .and_then(|value| value.as_u64())
        .filter(|value| *value > 0)
        .unwrap_or(60)
        .min(600) as u128
        * 1_000
}

// Returns the per-channel signing material required for remote Broadcast commands.
fn sync_command_key_material() -> Result<String, String> {
    let signing_key = sync_string("commandSecret", "");
    if signing_key.chars().count() < 32 {
        return Err(
            "sync command authentication is not configured; run fpasoterm --setup-sync on every trusted device"
                .to_string(),
        );
    }
    Ok(signing_key)
}

// Serializes only immutable command fields so both Rust and Node sign the same bytes.
fn terminal_broadcast_signature_payload(item: &TerminalBroadcastItem) -> Result<Vec<u8>, String> {
    serde_json::to_vec(&TerminalBroadcastSignaturePayload {
        schema_version: item.schema_version,
        id: &item.id,
        source_id: &item.source_id,
        created_at: item.created_at,
        expires_at: item.expires_at,
        text: &item.text,
        target_instance_ids: &item.target_instance_ids,
        key_event: item.key_event.as_ref(),
    })
    .map_err(|error| error.to_string())
}

// Produces an HMAC-SHA-256 signature for one shared-folder command file.
fn sign_terminal_broadcast_item(
    item: &TerminalBroadcastItem,
    signing_key: &str,
) -> Result<String, String> {
    let mut mac = Hmac::<Sha256>::new_from_slice(signing_key.as_bytes())
        .map_err(|error| error.to_string())?;
    mac.update(&terminal_broadcast_signature_payload(item)?);
    Ok(hex_encode(&mac.finalize().into_bytes()))
}

// Verifies that a shared-folder command originated from a device with the signing key.
fn terminal_broadcast_signature_valid(item: &TerminalBroadcastItem) -> bool {
    let Some(signature) = item.signature.as_deref() else {
        return false;
    };
    let Ok(signing_key) = sync_command_key_material() else {
        return false;
    };
    verify_terminal_broadcast_signature(item, &signing_key, signature)
}

// Checks a signature with supplied signing material; separated for deterministic tests.
fn verify_terminal_broadcast_signature(
    item: &TerminalBroadcastItem,
    signing_key: &str,
    signature: &str,
) -> bool {
    let Ok(payload) = terminal_broadcast_signature_payload(item) else {
        return false;
    };
    let Ok(bytes) = hex_decode(signature) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(signing_key.as_bytes()) else {
        return false;
    };
    mac.update(&payload);
    mac.verify_slice(&bytes).is_ok()
}

// Avoids adding another encoding dependency for the fixed-size HMAC output.
fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn hex_decode(value: &str) -> Result<Vec<u8>, String> {
    if value.len() % 2 != 0 {
        return Err("hex value must have an even length".to_string());
    }
    (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16).map_err(|error| error.to_string())
        })
        .collect()
}

// Returns a file modification timestamp in milliseconds, or zero when metadata
// cannot be read. Zero is treated as old during explicit cleanup only.
fn file_modified_millis(path: &Path) -> u128 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

// Inspects command files for one channel without creating or changing anything.
fn inspect_sync_channel(
    channel_dir: &Path,
    name: String,
    now: u128,
    ttl: u128,
) -> SyncChannelStatus {
    let commands_dir = channel_dir.join("commands");
    let mut status = SyncChannelStatus {
        name,
        diagnostics_exists: channel_dir.join("diagnostics.json").is_file(),
        active_commands: 0,
        stale_commands: 0,
        invalid_commands: 0,
        temporary_files: 0,
    };
    let Ok(entries) = fs::read_dir(commands_dir) else {
        return status;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if name.starts_with("command-") && name.ends_with(".json") {
            match fs::read_to_string(&path)
                .ok()
                .and_then(|text| serde_json::from_str::<TerminalBroadcastItem>(&text).ok())
            {
                Some(item) if item.expires_at > now => status.active_commands += 1,
                Some(_) => status.stale_commands += 1,
                None => status.invalid_commands += 1,
            }
        } else if name.starts_with("command-") && name.ends_with(".tmp") {
            if file_modified_millis(&path).saturating_add(ttl) <= now {
                status.temporary_files += 1;
            }
        }
    }
    status
}

// Lists channel directories below a configured sync root without treating logs
// or arbitrary files as channels.
fn inspect_sync_channels(root: &Path, now: u128, ttl: u128) -> Vec<SyncChannelStatus> {
    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };
    let mut channels = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() {
                return None;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            Some(inspect_sync_channel(&path, name, now, ttl))
        })
        .collect::<Vec<_>>();
    channels.sort_by(|left, right| left.name.cmp(&right.name));
    channels
}

// Deletes only commands which are already expired and abandoned temporary or
// malformed files older than the configured TTL. It never removes diagnostics
// or still-valid broadcast commands.
fn clean_sync_commands(root: &Path, now: u128, ttl: u128) -> SyncCleanupResult {
    let mut result = SyncCleanupResult {
        path: root.display().to_string(),
        channel: sync_channel(),
        removed_expired_commands: 0,
        removed_invalid_commands: 0,
        removed_temporary_files: 0,
        message: String::new(),
    };
    let Ok(channels) = fs::read_dir(root) else {
        result.message = "sync root does not exist; nothing to clean".to_string();
        return result;
    };
    for channel in channels.flatten() {
        let command_dir = channel.path().join("commands");
        let Ok(entries) = fs::read_dir(command_dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("");
            let old_enough = file_modified_millis(&path).saturating_add(ttl) <= now;
            let removal = if name.starts_with("command-") && name.ends_with(".json") {
                match fs::read_to_string(&path)
                    .ok()
                    .and_then(|text| serde_json::from_str::<TerminalBroadcastItem>(&text).ok())
                {
                    Some(item) if item.expires_at <= now => Some("expired"),
                    None if old_enough => Some("invalid"),
                    _ => None,
                }
            } else if name.starts_with("command-") && name.ends_with(".tmp") && old_enough {
                Some("temporary")
            } else {
                None
            };
            let Some(removal) = removal else {
                continue;
            };
            if fs::remove_file(&path).is_ok() {
                match removal {
                    "expired" => result.removed_expired_commands += 1,
                    "invalid" => result.removed_invalid_commands += 1,
                    _ => result.removed_temporary_files += 1,
                }
            }
        }
    }
    result.message = format!(
        "removed expired={} invalid={} temporary={}",
        result.removed_expired_commands,
        result.removed_invalid_commands,
        result.removed_temporary_files
    );
    result
}

// Atomically publishes a command file so readers never observe partial JSON.
fn write_terminal_broadcast_item(
    directory: &Path,
    item: &TerminalBroadcastItem,
) -> Result<(), String> {
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let path = directory.join(format!("command-{}.json", item.id));
    let temporary = directory.join(format!("command-{}.tmp", item.id));
    let text = serde_json::to_string(item).map_err(|error| error.to_string())?;
    fs::write(&temporary, text).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &path).map_err(|error| error.to_string())
}

// Loads unexpired requests created after this instance started and removes expired files.
fn read_terminal_broadcast_items(
    directory: &Path,
    started_at: u128,
    require_signature: bool,
) -> Vec<TerminalBroadcastItem> {
    let Ok(entries) = fs::read_dir(directory) else {
        return Vec::new();
    };
    let now = now_millis();
    let mut items = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
        if !name.starts_with("command-") || !name.ends_with(".json") {
            continue;
        }
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(item) = serde_json::from_str::<TerminalBroadcastItem>(&text) else {
            continue;
        };
        if item.expires_at <= now {
            let _ = fs::remove_file(path);
            continue;
        }
        if item.schema_version == 1
            && item.created_at >= started_at
            && !item.text.is_empty()
            && (!require_signature || terminal_broadcast_signature_valid(&item))
        {
            items.push(item);
        }
    }
    items.sort_by_key(|item| item.created_at);
    items
}

#[tauri::command]
// Resizes the active PTY to match the xterm.js grid.
fn terminal_resize(state: State<AppState>, size: TerminalSize) -> Result<(), String> {
    let terminal = state.terminal.lock().map_err(|error| error.to_string())?;
    if let Some(session) = terminal.as_ref() {
        if console_diagnostics_enabled() {
            eprintln!(
                "terminal_resize cols={} rows={} pixel_width={} pixel_height={}",
                size.cols, size.rows, size.pixel_width, size.pixel_height
            );
        }
        session
            .master
            .resize(PtySize {
                rows: size.rows.max(1),
                cols: size.cols.max(1),
                pixel_width: size.pixel_width,
                pixel_height: size.pixel_height,
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
    let title = runtime_config().config.window.title;
    terminal_log_directory().join(format!(
        "terminal-{}-{}.log",
        log_file_component(&title),
        now_millis()
    ))
}

// Converts a window title into a portable, visible log-file component.
fn log_file_component(title: &str) -> String {
    let value = title
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .chars()
        .take(80)
        .collect::<String>();
    if value.is_empty() {
        "fpasoterm".to_string()
    } else {
        value
    }
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

// Appends cleaned PTY output bytes to the active terminal log if logging is active.
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

    let text = log.decoder.decode(bytes);
    let cleaned = log.normalizer.normalize(&text).into_bytes();
    if cleaned.is_empty() {
        return;
    }

    let remaining = (max_bytes - log.bytes_written) as usize;
    let write_len = cleaned.len().min(remaining);
    if write_len == 0 {
        return;
    }

    if log.file.write_all(&cleaned[..write_len]).is_ok() {
        log.bytes_written += write_len as u64;
        let _ = log.file.flush();
    }
}

#[tauri::command]
// Starts writing cleaned terminal output to a log file.
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
        decoder: TerminalOutputDecoder::new(terminal_output_encoding(&runtime_config().config)),
        normalizer: TerminalTextNormalizer::new(),
    });
    if let Ok(mut last_path) = state.last_terminal_log_path.lock() {
        *last_path = Some(path_text.clone());
    }
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
        if let Ok(mut last_path) = state.last_terminal_log_path.lock() {
            *last_path = Some(log.path.clone());
        }
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

    let last_path = state
        .last_terminal_log_path
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
        .unwrap_or_default();

    Ok(TerminalLogStatus {
        enabled: logging_bool("enabled", true),
        active: false,
        path: last_path,
        bytes_written: 0,
        message: "terminal output logging is inactive".to_string(),
    })
}

// Finds the newest timestamped terminal output log in the configured log directory.
fn latest_terminal_log_path() -> Result<Option<PathBuf>, String> {
    let directory = terminal_log_directory();
    if !directory.exists() {
        return Ok(None);
    }

    let mut latest: Option<(SystemTime, PathBuf)> = None;
    for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let is_terminal_log = path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.starts_with("terminal-") && name.ends_with(".log"))
            .unwrap_or(false);
        if !is_terminal_log {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(UNIX_EPOCH);
        if latest
            .as_ref()
            .map(|(latest_modified, _)| modified > *latest_modified)
            .unwrap_or(true)
        {
            latest = Some((modified, path));
        }
    }

    Ok(latest.map(|(_, path)| path))
}

// Returns all timestamped terminal logs newest first, including the active log.
fn terminal_log_items(active_path: Option<String>) -> Result<Vec<TerminalLogItem>, String> {
    let directory = terminal_log_directory();
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let active_pathbuf = active_path.as_ref().map(PathBuf::from);
    let mut items = Vec::new();
    for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();
        if !name.starts_with("terminal-") || !name.ends_with(".log") {
            continue;
        }
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let modified_at = metadata
            .modified()
            .unwrap_or(UNIX_EPOCH)
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let active = active_pathbuf
            .as_ref()
            .is_some_and(|active_path| *active_path == path);
        items.push(TerminalLogItem {
            path: path.display().to_string(),
            name,
            bytes: metadata.len(),
            active,
            modified_at,
        });
    }
    items.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    Ok(items)
}

// Resolves a renderer-selected log path and only permits terminal-*.log files.
fn selected_terminal_log_path(path_request: Option<String>) -> Result<Option<PathBuf>, String> {
    let Some(path_text) = path_request
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };
    let path = expand_sync_path(&path_text);
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    if !name.starts_with("terminal-") || !name.ends_with(".log") {
        return Err("selected path is not a terminal output log".to_string());
    }
    Ok(Some(path))
}

// Reads the tail of a log file without loading very large logs into memory.
fn read_terminal_log_tail(path: &Path, max_bytes: u64) -> Result<(String, u64, bool), String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let bytes = file.metadata().map_err(|error| error.to_string())?.len();
    let start = bytes.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(start))
        .map_err(|error| error.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|error| error.to_string())?;
    Ok((
        String::from_utf8_lossy(&buffer).to_string(),
        bytes,
        start > 0,
    ))
}

// Removes common terminal control sequences from raw PTY output for Log Show.
fn clean_terminal_log_preview_text(text: &str) -> String {
    let mut normalizer = TerminalTextNormalizer::new();
    normalizer.normalize(text)
}

// Reads the first numeric CSI parameter, using a default when the sequence omits it.
fn first_csi_numeric_parameter(parameters: &str, default: usize) -> usize {
    parameters
        .split(';')
        .find_map(|parameter| {
            let normalized = parameter.trim_start_matches('?').trim();
            if normalized.is_empty() {
                None
            } else {
                normalized.parse::<usize>().ok()
            }
        })
        .unwrap_or(default)
}

// Reads the first two numeric CSI parameters, using defaults for omitted values.
fn first_two_csi_numeric_parameters(
    parameters: &str,
    first_default: usize,
    second_default: usize,
) -> (usize, usize) {
    let mut values = parameters.split(';').map(|parameter| {
        let normalized = parameter.trim_start_matches('?').trim();
        if normalized.is_empty() {
            None
        } else {
            normalized.parse::<usize>().ok()
        }
    });
    (
        values.next().flatten().unwrap_or(first_default),
        values.next().flatten().unwrap_or(second_default),
    )
}

#[tauri::command]
// Returns a selected, active, last stopped, or newest terminal output log for quick inspection.
fn terminal_log_show(
    state: State<AppState>,
    request: Option<TerminalLogPathRequest>,
) -> Result<TerminalLogPreview, String> {
    let requested_path = selected_terminal_log_path(request.and_then(|value| value.path))?;
    let tracked_path = {
        let guard = state
            .terminal_log
            .lock()
            .map_err(|error| error.to_string())?;
        guard.as_ref().map(|log| log.path.clone())
    };
    let last_path = state
        .last_terminal_log_path
        .lock()
        .ok()
        .and_then(|guard| guard.clone());

    let path = match requested_path
        .or_else(|| tracked_path.map(PathBuf::from))
        .or_else(|| last_path.map(PathBuf::from))
    {
        Some(value) => PathBuf::from(value),
        None => match latest_terminal_log_path()? {
            Some(path) => path,
            None => {
                return Ok(TerminalLogPreview {
                    path: String::new(),
                    text: String::new(),
                    bytes: 0,
                    truncated: false,
                    message: "terminal output log was not found".to_string(),
                });
            }
        },
    };

    let (text, bytes, truncated) = read_terminal_log_tail(&path, 65_536)?;
    Ok(TerminalLogPreview {
        path: path.display().to_string(),
        text: clean_terminal_log_preview_text(&text),
        bytes,
        truncated,
        message: if truncated {
            "showing the last 65536 bytes of the terminal output log".to_string()
        } else {
            "showing the terminal output log".to_string()
        },
    })
}

#[tauri::command]
// Lists selectable terminal output logs for the Log Show dropdown.
fn terminal_log_list(state: State<AppState>) -> Result<Vec<TerminalLogItem>, String> {
    let active_path = state
        .terminal_log
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
        .map(|log| log.path.clone());
    terminal_log_items(active_path)
}

#[tauri::command]
// Deletes one selected stopped terminal output log.
fn terminal_log_delete(
    state: State<AppState>,
    request: Option<TerminalLogPathRequest>,
) -> Result<TerminalLogStatus, String> {
    let path = selected_terminal_log_path(request.and_then(|value| value.path))?
        .ok_or_else(|| "terminal output log path is required".to_string())?;
    let path_text = path.display().to_string();
    let active_path = state
        .terminal_log
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
        .map(|log| log.path.clone());
    if active_path.as_deref() == Some(path_text.as_str()) {
        return Err(
            "active terminal output log cannot be deleted; use Delete All to empty it".to_string(),
        );
    }
    if path.exists() {
        fs::remove_file(&path).map_err(|error| error.to_string())?;
    }
    if let Ok(mut last_path) = state.last_terminal_log_path.lock() {
        if last_path.as_deref() == Some(path_text.as_str()) {
            *last_path = None;
        }
    }
    Ok(TerminalLogStatus {
        enabled: logging_bool("enabled", true),
        active: false,
        path: path_text,
        bytes_written: 0,
        message: "selected terminal output log deleted".to_string(),
    })
}

#[tauri::command]
// Clears the active log file and deletes all stopped terminal log files.
fn terminal_log_clear(state: State<AppState>) -> Result<TerminalLogStatus, String> {
    let mut active_path: Option<String> = None;
    let mut active = false;
    {
        let mut guard = state
            .terminal_log
            .lock()
            .map_err(|error| error.to_string())?;
        if let Some(log) = guard.as_mut() {
            log.file.set_len(0).map_err(|error| error.to_string())?;
            log.file
                .seek(SeekFrom::Start(0))
                .map_err(|error| error.to_string())?;
            log.bytes_written = 0;
            log.decoder =
                TerminalOutputDecoder::new(terminal_output_encoding(&runtime_config().config));
            log.normalizer = TerminalTextNormalizer::new();
            let _ = log.file.flush();
            active_path = Some(log.path.clone());
            active = true;
        }
    }

    let active_pathbuf = active_path.as_ref().map(PathBuf::from);
    let directory = terminal_log_directory();
    let mut deleted = 0_u64;
    let mut cleared = 0_u64;
    let mut failed = 0_u64;
    let mut first_error = None;
    if directory.exists() {
        for entry in fs::read_dir(&directory).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            let is_terminal_log = path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with("terminal-") && name.ends_with(".log"))
                .unwrap_or(false);
            if !is_terminal_log
                || active_pathbuf
                    .as_ref()
                    .is_some_and(|active| *active == path)
            {
                continue;
            }
            match delete_or_clear_terminal_log_file(&path) {
                Ok(TerminalLogCleanup::Deleted) => deleted += 1,
                Ok(TerminalLogCleanup::Cleared) => cleared += 1,
                Err(error) => {
                    failed += 1;
                    first_error.get_or_insert(error);
                }
            }
        }
    }
    if let Ok(mut last_path) = state.last_terminal_log_path.lock() {
        if !active {
            *last_path = None;
        } else {
            *last_path = active_path.clone();
        }
    }
    let path_text = active_path.unwrap_or_else(|| directory.display().to_string());
    let cleanup_summary = if cleared > 0 || failed > 0 {
        format!(
            "; {cleared} locked log files emptied; {failed} files could not be cleared{}",
            first_error
                .as_ref()
                .map(|error| format!(" ({error})"))
                .unwrap_or_default()
        )
    } else {
        String::new()
    };
    Ok(TerminalLogStatus {
        enabled: logging_bool("enabled", true),
        active,
        path: path_text,
        bytes_written: 0,
        message: if active {
            format!(
                "active terminal output log cleared and {deleted} stopped log files deleted{cleanup_summary}"
            )
        } else {
            format!("{deleted} terminal output log files deleted{cleanup_summary}")
        },
    })
}

// Deletes a stopped log, falling back to truncation when Windows or a sync client locks its name.
fn delete_or_clear_terminal_log_file(path: &Path) -> Result<TerminalLogCleanup, String> {
    match fs::remove_file(path) {
        Ok(()) => return Ok(TerminalLogCleanup::Deleted),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(TerminalLogCleanup::Deleted);
        }
        Err(_) => {}
    }

    OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path)
        .and_then(|mut file| file.flush())
        .map(|()| TerminalLogCleanup::Cleared)
        .map_err(|error| format!("{}: {error}", path.display()))
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
    PathBuf::from(runtime_config().config_dir)
        .join("logs")
        .join("fpasoterm-debug.log")
        .display()
        .to_string()
}

#[tauri::command]
// Lets the renderer append messages to the backend diagnostics ring buffer.
fn diagnostics_log(app: AppHandle, message: String) {
    append_diagnostic(&app, &message);
}

// Runs a clipboard read command and lets Unix builds use coreutils timeout when available.
#[cfg(not(target_os = "windows"))]
fn clipboard_read_output(program: &str, args: &[&str]) -> Result<Output, std::io::Error> {
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let mut timeout_args = vec!["2s", program];
        timeout_args.extend_from_slice(args);
        if let Ok(output) = Command::new("timeout").args(timeout_args).output() {
            return Ok(output);
        }
    }

    Command::new(program).args(args).output()
}

// Attempts each command until one can read text from the OS clipboard.
#[cfg(not(target_os = "windows"))]
fn read_clipboard_with_commands(commands: &[(&str, &[&str])]) -> Result<String, String> {
    let mut errors = Vec::new();
    for (program, args) in commands {
        match clipboard_read_output(program, args) {
            Ok(output) if output.status.success() => {
                return Ok(String::from_utf8_lossy(&output.stdout).to_string());
            }
            Ok(output) => {
                errors.push(format!(
                    "{} exited with {}: {}",
                    program,
                    output.status,
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
            Err(error) => errors.push(format!("{program}: {error}")),
        }
    }
    Err(errors.join("; "))
}

#[cfg(target_os = "windows")]
// Opens the Windows clipboard for a short native read/write operation.
fn open_windows_clipboard() -> Result<(), String> {
    let opened = unsafe { OpenClipboard(ptr::null_mut()) };
    if opened == 0 {
        Err("OpenClipboard failed".to_string())
    } else {
        Ok(())
    }
}

#[cfg(target_os = "windows")]
// Reads Windows clipboard text from the native UTF-16 CF_UNICODETEXT format.
fn read_windows_clipboard_native() -> Result<String, String> {
    let available = unsafe { IsClipboardFormatAvailable(WINDOWS_CF_UNICODETEXT) };
    if available == 0 {
        return Ok(String::new());
    }

    open_windows_clipboard()?;
    let result = unsafe {
        let handle = GetClipboardData(WINDOWS_CF_UNICODETEXT);
        if handle.is_null() {
            Err("GetClipboardData(CF_UNICODETEXT) failed".to_string())
        } else {
            let locked = GlobalLock(handle) as *const u16;
            if locked.is_null() {
                Err("GlobalLock clipboard data failed".to_string())
            } else {
                let unit_capacity = GlobalSize(handle) / std::mem::size_of::<u16>();
                let units = slice::from_raw_parts(locked, unit_capacity);
                let len = units
                    .iter()
                    .position(|unit| *unit == 0)
                    .unwrap_or(unit_capacity);
                let text = String::from_utf16_lossy(&units[..len]);
                let _ = GlobalUnlock(handle);
                Ok(text)
            }
        }
    };
    unsafe {
        CloseClipboard();
    }
    result
}

#[cfg(target_os = "windows")]
// Writes Windows clipboard text as native UTF-16 CF_UNICODETEXT to avoid code page loss.
fn write_windows_clipboard_native(text: &str) -> Result<(), String> {
    let mut wide_text: Vec<u16> = text.encode_utf16().collect();
    wide_text.push(0);
    let byte_len = wide_text.len() * std::mem::size_of::<u16>();

    open_windows_clipboard()?;
    let result = unsafe {
        let handle = GlobalAlloc(GMEM_MOVEABLE, byte_len);
        if handle.is_null() {
            Err("GlobalAlloc clipboard data failed".to_string())
        } else {
            let locked = GlobalLock(handle) as *mut u16;
            if locked.is_null() {
                let _ = GlobalFree(handle);
                Err("GlobalLock clipboard data failed".to_string())
            } else {
                ptr::copy_nonoverlapping(wide_text.as_ptr(), locked, wide_text.len());
                let _ = GlobalUnlock(handle);

                if EmptyClipboard() == 0 {
                    let _ = GlobalFree(handle);
                    Err("EmptyClipboard failed".to_string())
                } else if SetClipboardData(WINDOWS_CF_UNICODETEXT, handle).is_null() {
                    let _ = GlobalFree(handle);
                    Err("SetClipboardData(CF_UNICODETEXT) failed".to_string())
                } else {
                    // SetClipboardData owns the handle after success.
                    Ok(())
                }
            }
        }
    };
    unsafe {
        CloseClipboard();
    }
    result
}

#[cfg(target_os = "windows")]
// Removes the UTF-8 BOM that Windows PowerShell may write with Set-Content -Encoding UTF8.
fn strip_utf8_bom(text: String) -> String {
    if let Some(stripped) = text.strip_prefix('\u{feff}') {
        stripped.to_string()
    } else {
        text
    }
}

#[cfg(target_os = "windows")]
// Builds a per-process temporary path for passing clipboard text without stdin encoding loss.
fn windows_clipboard_temp_path(name: &str) -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0);
    env::temp_dir().join(format!(
        "fpasoterm-{name}-{}-{timestamp}.txt",
        std::process::id()
    ))
}

#[cfg(target_os = "windows")]
// Reads Windows clipboard text through a UTF-8 temp file to avoid PowerShell stdout code pages.
fn read_windows_clipboard_with_powershell() -> Result<String, String> {
    let path = windows_clipboard_temp_path("clipboard-read");
    let path_string = path.display().to_string();
    let commands: [(&str, [&str; 5]); 2] = [
        (
            "pwsh.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-Clipboard -Raw | Set-Content -LiteralPath $args[0] -Encoding UTF8",
                &path_string,
            ],
        ),
        (
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-Clipboard -Raw | Set-Content -LiteralPath $args[0] -Encoding UTF8",
                &path_string,
            ],
        ),
    ];

    let mut errors = Vec::new();
    for (program, args) in commands {
        match Command::new(program)
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
        {
            Ok(output) if output.status.success() => {
                let text = fs::read_to_string(&path).map_err(|error| error.to_string());
                let _ = fs::remove_file(&path);
                return text.map(strip_utf8_bom);
            }
            Ok(output) => errors.push(format!(
                "{} exited with {}: {}",
                program,
                output.status,
                String::from_utf8_lossy(&output.stderr)
            )),
            Err(error) => errors.push(format!("{program}: {error}")),
        }
    }
    let _ = fs::remove_file(&path);
    Err(errors.join("; "))
}

#[cfg(target_os = "windows")]
// Writes Windows clipboard text through a UTF-8 temp file so Japanese paths survive Set-Clipboard.
fn write_windows_clipboard_with_powershell(text: &str) -> Result<(), String> {
    let path = windows_clipboard_temp_path("clipboard-write");
    fs::write(&path, text.as_bytes()).map_err(|error| error.to_string())?;
    let path_string = path.display().to_string();
    let commands: [(&str, [&str; 5]); 2] = [
        (
            "pwsh.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Set-Clipboard -Value (Get-Content -LiteralPath $args[0] -Raw -Encoding UTF8)",
                &path_string,
            ],
        ),
        (
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Set-Clipboard -Value (Get-Content -LiteralPath $args[0] -Raw -Encoding UTF8)",
                &path_string,
            ],
        ),
    ];

    let mut errors = Vec::new();
    for (program, args) in commands {
        match Command::new(program)
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
        {
            Ok(output) if output.status.success() => {
                let _ = fs::remove_file(&path);
                return Ok(());
            }
            Ok(output) => errors.push(format!(
                "{} exited with {}: {}",
                program,
                output.status,
                String::from_utf8_lossy(&output.stderr)
            )),
            Err(error) => errors.push(format!("{program}: {error}")),
        }
    }
    let _ = fs::remove_file(&path);
    Err(errors.join("; "))
}

// Attempts each command until one can write text to the OS clipboard.
#[cfg(not(target_os = "windows"))]
fn write_clipboard_with_commands(commands: &[(&str, &[&str])], text: &str) -> Result<(), String> {
    let mut errors = Vec::new();
    for (program, args) in commands {
        match Command::new(program)
            .args(*args)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(mut child) => {
                if let Some(mut stdin) = child.stdin.take() {
                    if let Err(error) = stdin.write_all(text.as_bytes()) {
                        errors.push(format!("{program} stdin: {error}"));
                        let _ = child.kill();
                        continue;
                    }
                }

                #[cfg(all(unix, not(target_os = "macos")))]
                {
                    if *program == "wl-copy" {
                        match child.wait_with_output() {
                            Ok(output) if output.status.success() => return Ok(()),
                            Ok(output) => errors.push(format!(
                                "{} exited with {}: {}",
                                program,
                                output.status,
                                String::from_utf8_lossy(&output.stderr)
                            )),
                            Err(error) => errors.push(format!("{program}: {error}")),
                        }
                        continue;
                    }

                    // xclip/xsel commonly remain alive as the clipboard owner. Waiting for
                    // them blocks the Tauri command and freezes the UI, so success is spawn
                    // plus stdin delivery on Unix desktops.
                    return Ok(());
                }

                #[cfg(any(not(unix), target_os = "macos"))]
                {
                    match child.wait_with_output() {
                        Ok(output) if output.status.success() => return Ok(()),
                        Ok(output) => errors.push(format!(
                            "{} exited with {}: {}",
                            program,
                            output.status,
                            String::from_utf8_lossy(&output.stderr)
                        )),
                        Err(error) => errors.push(format!("{program}: {error}")),
                    }
                }
            }
            Err(error) => errors.push(format!("{program}: {error}")),
        }
    }
    Err(errors.join("; "))
}

#[tauri::command]
// Reads text from the OS clipboard for terminal paste shortcuts.
fn clipboard_read() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        return read_clipboard_with_commands(&[("pbpaste", &[])]);
    }

    #[cfg(target_os = "windows")]
    {
        return read_windows_clipboard_native()
            .or_else(|_| read_windows_clipboard_with_powershell());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        read_clipboard_with_commands(&[
            ("wl-paste", &["--no-newline", "--type", "text/plain"]),
            ("xclip", &["-selection", "clipboard", "-out"]),
            ("xsel", &["--clipboard", "--output"]),
        ])
    }
}

#[tauri::command]
// Writes text to the OS clipboard for terminal OSC 52 copy requests.
fn clipboard_write(text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return write_clipboard_with_commands(&[("pbcopy", &[])], &text);
    }

    #[cfg(target_os = "windows")]
    {
        return write_windows_clipboard_native(&text)
            .or_else(|_| write_windows_clipboard_with_powershell(&text));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        write_clipboard_with_commands(
            &[
                ("wl-copy", &["--type", "text/plain;charset=utf-8"]),
                (
                    "xclip",
                    &["-selection", "clipboard", "-target", "UTF8_STRING"],
                ),
                ("xsel", &["--clipboard", "--input"]),
            ],
            &text,
        )
    }
}

// Opens only an explicitly confirmed HTTP(S) URL. Terminal output never invokes
// this command on its own, and platform-specific launchers receive the URL as a
// single argument rather than a shell command string.
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let value = validated_external_url(&url)?;

    #[cfg(target_os = "windows")]
    {
        let operation = windows_wide("open");
        let target = windows_wide(&value);
        let result = unsafe {
            ShellExecuteW(
                ptr::null_mut(),
                operation.as_ptr(),
                target.as_ptr(),
                ptr::null(),
                ptr::null(),
                1,
            )
        };
        if (result as isize) <= 32 {
            return Err(format!(
                "Windows could not open the URL (ShellExecute error {})",
                result as isize
            ));
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&value)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("could not open URL with macOS open command: {error}"))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&value)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("could not open URL with xdg-open: {error}"))?;
        Ok(())
    }
}

// Performs a narrow URL validation before a user-confirmed browser launch.
fn validated_external_url(url: &str) -> Result<String, String> {
    let value = url.trim();
    if value.is_empty() || value.len() > 8192 || value.chars().any(char::is_control) {
        return Err("URL is empty, too long, or contains a control character".to_string());
    }
    let without_scheme = if let Some(rest) = value.strip_prefix("https://") {
        rest
    } else if let Some(rest) = value.strip_prefix("http://") {
        rest
    } else {
        return Err("only http:// and https:// URLs may be opened".to_string());
    };
    let authority = without_scheme.split('/').next().unwrap_or_default();
    if authority.is_empty() || authority.starts_with('@') {
        return Err("URL must include a host name".to_string());
    }
    Ok(value.to_string())
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
// Returns the package version with the build commit embedded by build.rs.
fn app_version() -> String {
    let commit = option_env!("FPASOTERM_BUILD_COMMIT").unwrap_or("unknown");
    let short_commit = commit.get(..12).unwrap_or(commit);
    format!("{} (commit {})", env!("CARGO_PKG_VERSION"), short_commit)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
// Describes the explicit npm registry update check for CLI and GUI callers.
struct NpmUpdateCheck {
    installed: String,
    latest: String,
    update_available: bool,
    local_build_newer: bool,
}

// Queries the npm package metadata only when an update check is explicitly requested.
fn npm_update_check() -> Result<NpmUpdateCheck, String> {
    let url = "https://registry.npmjs.org/fpasoterm/latest";
    let response = ureq::get(url)
        .set(
            "User-Agent",
            concat!("fpasoterm/", env!("CARGO_PKG_VERSION")),
        )
        .timeout(Duration::from_secs(10))
        .call()
        .map_err(|error| format!("could not check npm latest release: {error}"))?;
    let mut body = String::new();
    response
        .into_reader()
        .take(64 * 1024)
        .read_to_string(&mut body)
        .map_err(|error| format!("could not read npm latest release: {error}"))?;
    let latest = serde_json::from_str::<serde_json::Value>(&body)
        .ok()
        .and_then(|value| {
            value
                .get("version")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .filter(|value| public_plugin_version_at_least(value, value))
        .ok_or_else(|| "npm registry did not return a stable latest version".to_string())?;
    let installed = env!("CARGO_PKG_VERSION").to_string();
    Ok(NpmUpdateCheck {
        update_available: !public_plugin_version_at_least(&installed, &latest),
        local_build_newer: !public_plugin_version_at_least(&latest, &installed),
        installed,
        latest,
    })
}

// Formats the update result consistently for direct-binary CLI output.
fn npm_update_check_text(status: &NpmUpdateCheck) -> String {
    let mut lines = vec![
        format!("installed: fpasoterm {}", app_version()),
        format!("latest npm release: {}", status.latest),
    ];
    if status.update_available {
        lines.push("status: update available".to_string());
        lines.push("update: fpasoterm --self-update".to_string());
    } else if status.local_build_newer {
        lines.push("status: local build is newer than npm latest".to_string());
    } else {
        lines.push("status: up to date".to_string());
    }
    format!("{}\n", lines.join("\n"))
}

// Prints a read-only maintenance summary for standalone native binaries.
// npm audit needs the JavaScript package manifest, so it runs in the Node launcher
// and is intentionally reported as unavailable for a bundled executable.
fn doctor_cli() {
    let (config_report, config_valid) = config_check_report();
    print_cli_text("## fpasoterm doctor\n\n");
    print_cli_text(&format!("- version: {}\n", app_version()));
    for line in config_report.lines() {
        if let Some(value) = line.strip_prefix("config: ") {
            print_cli_text(&format!("- config: {value}\n"));
        } else if let Some(value) = line.strip_prefix("status: ") {
            print_cli_text(&format!("- config status: {value}\n"));
        } else if line.starts_with("- ") {
            print_cli_text(&format!("- config warning: {}\n", &line[2..]));
        }
    }
    match npm_update_check() {
        Ok(status) if status.update_available => {
            print_cli_text(&format!(
                "- npm latest: {}\n- update: available; run fpasoterm --self-update\n",
                status.latest
            ));
        }
        Ok(status) if status.local_build_newer => {
            print_cli_text(&format!(
                "- npm latest: {}\n- update: local build is newer\n",
                status.latest
            ));
        }
        Ok(status) => print_cli_text(&format!(
            "- npm latest: {}\n- update: up to date\n",
            status.latest
        )),
        Err(error) => print_cli_text(&format!("- update: unavailable ({error})\n")),
    }
    print_cli_text("- npm audit: unavailable (standalone binary has no npm package context)\n");
    print_cli_text(
        "\nDoctor is read-only. Review findings, then update or edit config.toml explicitly.\n",
    );
    if !config_valid {
        std::process::exit(1);
    }
}

#[tauri::command]
// Exposes the explicit npm update status to the Help panel without auto-checking at startup.
fn update_check() -> Result<NpmUpdateCheck, String> {
    npm_update_check()
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

#[tauri::command]
// Persists a supported PTY output decoder choice for the next terminal launch.
fn config_set_terminal_encoding(app: AppHandle, encoding: String) -> Result<String, String> {
    let normalized = match encoding.trim().to_ascii_lowercase().as_str() {
        "utf-8" | "utf8" => "utf-8",
        "shift-jis" | "shift_jis" | "sjis" => "shift-jis",
        "euc-jp" | "euc_jp" | "eucjp" => "euc-jp",
        _ => return Err("unsupported encoding; choose utf-8, shift-jis, or euc-jp".to_string()),
    };
    let runtime = runtime_config();
    let config_path = runtime.config_path;
    let mut config = read_toml_config_or_empty(&config_path)?;
    let root = config
        .as_table_mut()
        .ok_or_else(|| "config root must be a TOML table".to_string())?;
    let terminal = root
        .entry("terminal".to_string())
        .or_insert_with(|| toml::Value::Table(toml::map::Map::new()))
        .as_table_mut()
        .ok_or_else(|| "terminal must be a TOML table".to_string())?;
    terminal.insert(
        "encoding".to_string(),
        toml::Value::String(normalized.to_string()),
    );
    if let Some(parent) = Path::new(&config_path).parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    write_toml_config(&config_path, &config)?;
    append_diagnostic(
        &app,
        &format!("saved terminal encoding {normalized} to {config_path}"),
    );
    Ok(config_path)
}

// Resolved sync-folder paths for the active channel.
struct SyncFolderPaths {
    provider: String,
    root: std::path::PathBuf,
    channel: String,
    diagnostics: std::path::PathBuf,
    commands: std::path::PathBuf,
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

// Resolves the sync channel directory. Mutating operations create missing paths;
// status checks intentionally do not change the folder being inspected.
fn sync_folder_paths(kind: &str) -> Result<SyncFolderPaths, String> {
    if !sync_bool("enabled", false) {
        return Err("sync folder is disabled; set sync.enabled = true".to_string());
    }

    let provider = sync_string("provider", "folder");
    if provider != "folder" {
        return Err(format!("unsupported sync provider: {provider}"));
    }

    if kind == "diagnostics" && !sync_bool("diagnostics", true) {
        return Err("sync diagnostics is disabled; set sync.diagnostics = true".to_string());
    }
    if kind == "commands" && !sync_bool("commands", false) {
        return Err("sync commands are disabled; set sync.commands = true".to_string());
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
    let commands = channel_dir.join("commands");
    if kind != "status" {
        fs::create_dir_all(&channel_dir).map_err(|error| error.to_string())?;
    }
    if kind == "commands" {
        fs::create_dir_all(&commands).map_err(|error| error.to_string())?;
    }

    Ok(SyncFolderPaths {
        provider,
        root,
        channel,
        diagnostics: channel_dir.join("diagnostics.json"),
        commands,
    })
}

// Selects the only supported sync item file names.
fn sync_item_path(kind: &str) -> Result<std::path::PathBuf, String> {
    let paths = sync_folder_paths(kind)?;
    match kind {
        "diagnostics" => Ok(paths.diagnostics),
        _ => Err(format!("unsupported sync item kind: {kind}")),
    }
}

// Resolves the shared directory used for short-lived terminal input commands.
fn sync_command_directory() -> Result<PathBuf, String> {
    Ok(sync_folder_paths("commands")?.commands)
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

#[tauri::command]
// Returns where sync-folder files would be read and written.
fn sync_status() -> SyncStatus {
    match sync_folder_paths("status") {
        Ok(paths) => {
            let now = now_millis();
            let ttl = sync_command_ttl_millis();
            let root_metadata = fs::metadata(&paths.root).ok();
            let root_exists = root_metadata
                .as_ref()
                .is_some_and(|metadata| metadata.is_dir());
            let root_readable = root_exists && fs::read_dir(&paths.root).is_ok();
            let root_writable = root_metadata
                .as_ref()
                .is_some_and(|metadata| !metadata.permissions().readonly());
            let diagnostics_metadata = fs::metadata(&paths.diagnostics).ok();
            let diagnostics_exists = diagnostics_metadata
                .as_ref()
                .is_some_and(|metadata| metadata.is_file());
            let diagnostics_bytes = diagnostics_metadata.as_ref().map_or(0, fs::Metadata::len);
            let diagnostics_updated_at = diagnostics_metadata
                .as_ref()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis())
                .unwrap_or(0);
            let channels = inspect_sync_channels(&paths.root, now, ttl);
            let current = channels.iter().find(|item| item.name == paths.channel);
            let active_commands = current.map_or(0, |item| item.active_commands);
            let stale_commands = current.map_or(0, |item| item.stale_commands);
            let invalid_commands = current.map_or(0, |item| item.invalid_commands);
            let temporary_files = current.map_or(0, |item| item.temporary_files);
            let health = if !root_exists {
                "missing".to_string()
            } else if !root_readable {
                "unreadable".to_string()
            } else if !root_writable {
                "read-only".to_string()
            } else if stale_commands + invalid_commands + temporary_files > 0 {
                "cleanup recommended".to_string()
            } else {
                "ok".to_string()
            };
            let message = if health == "ok" {
                "sync folder is healthy".to_string()
            } else {
                format!("sync folder health: {health}")
            };
            SyncStatus {
                enabled: true,
                provider: paths.provider,
                path: paths.root.display().to_string(),
                channel: paths.channel,
                diagnostics_path: paths.diagnostics.display().to_string(),
                commands_path: paths.commands.display().to_string(),
                health,
                root_exists,
                root_readable,
                root_writable,
                diagnostics_exists,
                diagnostics_bytes,
                diagnostics_updated_at,
                active_commands,
                stale_commands,
                invalid_commands,
                temporary_files,
                channels,
                message,
            }
        }
        Err(message) => SyncStatus {
            enabled: false,
            provider: sync_string("provider", "folder"),
            path: sync_string("path", ""),
            channel: sync_channel(),
            diagnostics_path: String::new(),
            commands_path: String::new(),
            health: "disabled".to_string(),
            root_exists: false,
            root_readable: false,
            root_writable: false,
            diagnostics_exists: false,
            diagnostics_bytes: 0,
            diagnostics_updated_at: 0,
            active_commands: 0,
            stale_commands: 0,
            invalid_commands: 0,
            temporary_files: 0,
            channels: Vec::new(),
            message,
        },
    }
}

#[tauri::command]
// Removes stale command files after an explicit user request.
fn sync_clean() -> Result<SyncCleanupResult, String> {
    let paths = sync_folder_paths("status")?;
    Ok(clean_sync_commands(
        &paths.root,
        now_millis(),
        sync_command_ttl_millis(),
    ))
}

// Formats the sync inspection result for terminals and issue reports.
fn sync_status_text(status: &SyncStatus) -> String {
    let mut lines = vec![
        "## fpasoterm sync status".to_string(),
        String::new(),
        format!(
            "- status: {}",
            if status.enabled {
                "enabled"
            } else {
                "disabled"
            }
        ),
        format!("- health: {}", status.health),
        format!("- provider: {}", status.provider),
        format!(
            "- path: {}",
            if status.path.is_empty() {
                "(not configured)"
            } else {
                &status.path
            }
        ),
        format!(
            "- channel: {}",
            if status.channel.is_empty() {
                "(not configured)"
            } else {
                &status.channel
            }
        ),
        format!("- root exists: {}", status.root_exists),
        format!("- root readable: {}", status.root_readable),
        format!("- root writable: {}", status.root_writable),
        format!(
            "- diagnostics: {} ({} bytes)",
            status.diagnostics_exists, status.diagnostics_bytes
        ),
        format!(
            "- command directory: {}",
            if status.commands_path.is_empty() {
                "(not available)"
            } else {
                &status.commands_path
            }
        ),
        format!(
            "- commands: active={} stale={} invalid={} temporary={}",
            status.active_commands,
            status.stale_commands,
            status.invalid_commands,
            status.temporary_files
        ),
        format!("- message: {}", status.message),
        String::new(),
        "### Channels".to_string(),
    ];
    if status.channels.is_empty() {
        lines.push("- (none found)".to_string());
    } else {
        for channel in &status.channels {
            lines.push(format!(
                "- {}: diagnostics={} active={} stale={} invalid={} temporary={}",
                channel.name,
                channel.diagnostics_exists,
                channel.active_commands,
                channel.stale_commands,
                channel.invalid_commands,
                channel.temporary_files
            ));
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

// Handles sync-only CLI operations without starting a Tauri window.
fn sync_cli() {
    if cli_has_flag(&["--sync-status", "--sync-diagnostics"]) {
        print_cli_text(&sync_status_text(&sync_status()));
        return;
    }
    if cli_has_flag(&["--sync-clean"]) {
        match sync_clean() {
            Ok(result) => print_cli_text(&format!(
                "sync clean: {}\npath: {}\nchannel: {}\n",
                result.message, result.path, result.channel
            )),
            Err(error) => {
                print_cli_error(&format!("fpasoterm: {error}\n"));
                std::process::exit(2);
            }
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn direct_cli_validation_rejects_unknown_options() {
        let args = vec!["--foo".to_string()];
        assert_eq!(
            validate_direct_cli_args(&args),
            Err("unknown option: --foo".to_string())
        );
    }

    #[test]
    fn direct_cli_validation_accepts_supported_options() {
        let flags = [
            "--help",
            "-h",
            "--version",
            "-v",
            "--update-check",
            "--doctor",
            "--plugin-search",
            "--list",
            "-l",
            "--foreground",
            "-F",
            "--console-diagnostics",
            "-C",
            "--show-config",
            "--config-check",
            "--config-path",
            "--config-example",
            "--diagnostics",
            "--open-log-dir",
            "--copy-diagnostics",
            "--profile-list",
            "--plugin-list",
            "--plugin-path",
            "--plugin-enable-all",
            "--plugin-disable-all",
            "--sync-status",
            "--sync-clean",
            "--sync-diagnostics",
            "--reset-window-state",
            "-r",
            "--reset-config",
            "-R",
            "--debug-keys",
            "-k",
            "--disable-dmabuf",
        ];
        for flag in flags {
            assert_eq!(
                validate_direct_cli_args(&[flag.to_string()]),
                Ok(()),
                "flag {flag} should be accepted"
            );
        }

        let value_options = [
            ("--config", "config.toml"),
            ("-c", "config.toml"),
            ("--completion", "bash"),
            ("--completion-install", "bash"),
            ("--completion-uninstall", "bash"),
            ("--profile", "large-font"),
            ("-p", "large-font"),
            ("--plugin-info", "welcome-banner.ts"),
            ("--plugin-uninstall", "welcome-banner.ts"),
            ("--enable-plugin", "welcome-banner.ts"),
            ("--disable-plugin", "welcome-banner.ts"),
            ("--plugin-enable", "welcome-banner.ts"),
            ("--plugin-disable", "welcome-banner.ts"),
            ("--plugin-install", "appearance/teal"),
            ("--plugin-install-file", "./my-plugin.ts"),
            ("--shell", "/bin/zsh"),
            ("-s", "/bin/zsh"),
            ("--cwd", "."),
            ("-o", "."),
            ("--command", "echo ok"),
            ("-e", "echo ok"),
            ("--title", "TEST"),
            ("-t", "TEST"),
            ("--titlebar-color", "#1565c0"),
            ("-b", "#1565c0"),
            ("--close", "all"),
            ("-q", "all"),
            ("--width", "800"),
            ("-W", "800"),
            ("--height", "600"),
            ("-H", "600"),
            ("--size", "800x600"),
            ("-z", "800x600"),
        ];
        for (option, value) in value_options {
            assert_eq!(
                validate_direct_cli_args(&[option.to_string(), value.to_string()]),
                Ok(()),
                "option {option} should be accepted"
            );
        }
        assert_eq!(
            validate_direct_cli_args(&[
                "--plugin-install".to_string(),
                "appearance/teal".to_string(),
                "--plugin-ports-dir".to_string(),
                "../fpasoterm-plugins".to_string(),
            ]),
            Ok(())
        );
        assert_eq!(
            validate_direct_cli_args(&["--size=800x600".to_string()]),
            Ok(())
        );
        assert_eq!(
            validate_direct_cli_args(&[
                "--plugin-install".to_string(),
                "appearance/teal".to_string(),
                "--enable".to_string(),
            ]),
            Ok(())
        );
    }

    #[test]
    fn direct_cli_validation_rejects_invalid_dimensions() {
        let args = vec!["--width".to_string(), "0".to_string()];
        assert_eq!(
            validate_direct_cli_args(&args),
            Err("--width must be a positive integer".to_string())
        );
    }

    #[test]
    fn direct_cli_validation_rejects_plugin_uninstall_with_mutations() {
        let args = vec![
            "--plugin-uninstall".to_string(),
            "welcome-banner.ts".to_string(),
            "--plugin-enable".to_string(),
            "welcome-banner.ts".to_string(),
        ];
        assert_eq!(
            validate_direct_cli_args(&args),
            Err(
                "--plugin-uninstall cannot be combined with other plugin mutation options"
                    .to_string()
            )
        );
    }

    #[test]
    fn plugin_uninstall_removes_local_source_cache_and_enabled_entry() {
        let test_root =
            std::env::temp_dir().join(format!("fpasoterm-plugin-uninstall-{}", std::process::id()));
        let user_dir = test_root.join("User");
        let plugin_dir = user_dir.join("plugins");
        let cache_dir = user_dir.join("cache").join("plugins");
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::create_dir_all(&cache_dir).unwrap();
        fs::write(plugin_dir.join("hello.ts"), "// hello\n").unwrap();
        fs::write(plugin_dir.join("theme.js"), "// theme\n").unwrap();
        fs::write(cache_dir.join("theme.js"), "// generated cache\n").unwrap();
        let config_path = user_dir.join("config.toml");
        let mut config: toml::Value =
            toml::from_str("[plugins]\nenabled = [\"plugins/hello.ts\", \"plugins/theme.js\"]\n")
                .unwrap();
        let enabled = configured_plugins(&config);

        let removed = uninstall_local_plugins_cli(
            config_path.to_str().unwrap(),
            &mut config,
            &enabled,
            &["theme".to_string()],
        )
        .unwrap();

        assert_eq!(removed, vec!["plugins/theme.js"]);
        assert!(!plugin_dir.join("theme.js").exists());
        assert!(!cache_dir.join("theme.js").exists());
        assert_eq!(configured_plugins(&config), vec!["plugins/hello.ts"]);
        fs::remove_dir_all(test_root).unwrap();
    }

    #[test]
    fn direct_cli_validation_rejects_node_launcher_only_options() {
        for option in [
            "--dev",
            "-d",
            "--setup-sync",
            "--self-update",
            "--self-update-checkout",
            "--update-desktop",
            "--enable-plugin",
            "--disable-plugin",
        ] {
            assert!(
                validate_direct_cli_args(&[option.to_string()]).is_err(),
                "Node-only option {option} must not launch the packaged GUI"
            );
        }
    }

    #[test]
    fn direct_cli_validation_rejects_unknown_and_missing_values() {
        for option in ["--hoge", "-?"] {
            assert_eq!(
                validate_direct_cli_args(&[option.to_string()]),
                Err(format!("unknown option: {option}"))
            );
        }
        assert_eq!(
            validate_direct_cli_args(&["--title".to_string(), "-v".to_string()]),
            Err("--title requires a value".to_string())
        );
        assert_eq!(
            validate_direct_cli_args(&["--completion-uninstall".to_string()]),
            Err("--completion-uninstall requires a shell: bash, zsh, fish, or powershell (example: fpasoterm --completion-uninstall bash)".to_string())
        );
        assert_eq!(
            validate_direct_cli_args(&["--enable".to_string()]),
            Err("--force and --enable require a --plugin-install command".to_string())
        );
    }

    #[test]
    fn public_plugin_manifest_rejects_traversal_and_mismatched_metadata() {
        assert!(validate_public_plugin_port_id("appearance/teal").is_ok());
        assert!(validate_public_plugin_port_id("../appearance/teal").is_err());
        assert!(!safe_public_plugin_relative_path("../outside.ts"));
        let manifest = r#"
[port]
id = "appearance/other"
version = "1.0.0"
minFpasotermVersion = "1.5.0"
source = "plugin.ts"
installPath = "appearance/other.ts"
"#;
        assert!(parse_public_plugin_manifest("appearance/teal", manifest).is_err());
    }

    #[test]
    fn tile_grid_uses_expected_window_partitions() {
        assert_eq!(tile_grid(1), (1, 1));
        assert_eq!(tile_grid(2), (2, 1));
        assert_eq!(tile_grid(4), (2, 2));
        assert_eq!(tile_grid(5), (3, 2));
        assert_eq!(tile_grid(8), (4, 2));
        assert_eq!(tile_grid(9), (3, 3));
        assert_eq!(tile_grid(10), (5, 2));
    }

    #[test]
    fn tile_orders_windows_by_title_and_instance_suffix() {
        let mut instances = vec![
            ArrangeInstance {
                pid: 900,
                base_title: "work".to_string(),
                display_title: "work-10".to_string(),
                instance_number: 10,
                created_at: 30,
            },
            ArrangeInstance {
                pid: 400,
                base_title: "Zebra".to_string(),
                display_title: "Zebra".to_string(),
                instance_number: 1,
                created_at: 10,
            },
            ArrangeInstance {
                pid: 700,
                base_title: "work".to_string(),
                display_title: "work-2".to_string(),
                instance_number: 2,
                created_at: 20,
            },
            ArrangeInstance {
                pid: 300,
                base_title: "work".to_string(),
                display_title: "work".to_string(),
                instance_number: 1,
                created_at: 5,
            },
        ];

        sort_arrange_instances(&mut instances);

        assert_eq!(
            instances
                .iter()
                .map(|instance| instance.pid)
                .collect::<Vec<_>>(),
            vec![300, 700, 900, 400]
        );
    }

    #[test]
    fn instance_number_follows_the_display_suffix() {
        assert_eq!(instance_number_from_display_title("work", "work"), 1);
        assert_eq!(instance_number_from_display_title("work", "work-2"), 2);
        assert_eq!(instance_number_from_display_title("work", "work-9"), 9);
        assert_eq!(instance_number_from_display_title("work-2", "work-2-3"), 3);
        assert_eq!(instance_number_from_display_title("work", "other-7"), 1);
    }

    #[test]
    fn close_target_supports_pid_title_and_all() {
        assert!(close_target_matches("123", 123, "work"));
        assert!(close_target_matches("work", 123, "work"));
        assert!(close_target_matches("all", 123, "work"));
        assert!(close_target_matches("ALL", 456, "review"));
        assert!(!close_target_matches("124", 123, "work"));
        assert!(!close_target_matches("other", 123, "work"));
    }

    #[test]
    fn terminal_log_cleanup_deletes_stopped_files() {
        let path = env::temp_dir().join(format!(
            "fpasoterm-terminal-log-cleanup-{}-{}.log",
            std::process::id(),
            now_millis()
        ));
        fs::write(&path, b"terminal output").expect("create terminal log fixture");
        assert_eq!(
            delete_or_clear_terminal_log_file(&path),
            Ok(TerminalLogCleanup::Deleted)
        );
        assert!(!path.exists());
    }

    #[test]
    fn terminal_log_file_component_keeps_titles_portable() {
        assert_eq!(log_file_component("work window"), "work_window");
        assert_eq!(log_file_component("  "), "fpasoterm");
        assert_eq!(log_file_component("開発-2"), "開発-2");
    }

    #[test]
    fn intel_macos_uses_compact_default_font_size() {
        assert_eq!(terminal_font_size_for("macos", "x86_64"), 12);
        assert_eq!(terminal_font_size_for("macos", "aarch64"), 14);
        assert_eq!(terminal_font_size_for("windows", "x86_64"), 14);
        assert_eq!(terminal_line_height_for("macos", "aarch64"), 1.0);
        assert_eq!(terminal_line_height_for("linux", "x86_64"), 1.0);
    }

    #[test]
    fn macos_uses_native_monospace_font_before_hiragino() {
        assert_eq!(
            terminal_font_family_for("macos"),
            MACOS_TERMINAL_FONT_FAMILY
        );
        assert!(terminal_font_family_for("macos").starts_with("Menlo"));
        assert_eq!(
            terminal_font_family_for("linux"),
            DEFAULT_TERMINAL_FONT_FAMILY
        );
    }

    #[test]
    fn windows_extended_paths_are_normalized_before_file_url_encoding() {
        assert_eq!(
            normalize_file_url_path(
                "//?/C:/Users/example/.config/fpasoterm/User/cache/plugins/hello.js"
            ),
            "C:/Users/example/.config/fpasoterm/User/cache/plugins/hello.js"
        );
        assert_eq!(
            normalize_file_url_path("/tmp/fpasoterm/cache/plugins/hello.js"),
            "/tmp/fpasoterm/cache/plugins/hello.js"
        );
    }

    #[test]
    fn plugin_metadata_reads_headers_and_legacy_comment() {
        assert_eq!(
            plugin_metadata(
                "// @fpasoterm-plugin version: 1.2.3\n// @fpasoterm-plugin description: Example plugin\n"
            ),
            PluginMetadata {
                version: "1.2.3".to_string(),
                description: "Example plugin".to_string(),
            }
        );
        assert_eq!(
            plugin_metadata("// Existing plugin comment\nconst value = 1;\n"),
            PluginMetadata {
                version: "(not declared)".to_string(),
                description: "Existing plugin comment".to_string(),
            }
        );
    }

    #[test]
    fn embedded_default_config_is_complete_toml() {
        let text = default_config_toml_for_terminal_defaults(12, MACOS_TERMINAL_FONT_FAMILY, 1.0);
        let config: toml::Value = toml::from_str(&text).expect("parse embedded defaults");
        assert_eq!(config["window"]["width"].as_integer(), Some(1000));
        assert_eq!(config["terminal"]["fontSize"].as_integer(), Some(12));
        assert_eq!(config["terminal"]["lineHeight"].as_float(), Some(1.0));
        assert_eq!(
            config["terminal"]["fontFamily"].as_str(),
            Some(MACOS_TERMINAL_FONT_FAMILY)
        );
        assert!(config["terminal"].get("images").is_none());
        assert_eq!(config["keybindings"]["prefix"].as_str(), Some("Mod+Shift"));
        assert_eq!(config["keybindings"]["newWindow"].as_str(), Some("N"));
        assert_eq!(config["sync"]["enabled"].as_bool(), Some(false));
        assert_eq!(config["sync"]["commands"].as_bool(), Some(false));
        assert_eq!(config["sync"]["commandSecret"].as_str(), Some(""));
        assert_eq!(config["logging"]["enabled"].as_bool(), Some(true));
    }

    #[test]
    fn redacted_runtime_config_hides_sync_command_key() {
        let mut runtime = default_runtime_config();
        runtime.config.sync["commandSecret"] = serde_json::Value::String("test-key".repeat(8));

        let display = redact_runtime_config(runtime);
        assert_eq!(
            display.config.sync["commandSecret"].as_str(),
            Some("[redacted]")
        );
    }

    #[test]
    fn runtime_snapshot_only_applies_to_launcher_or_owner_process() {
        assert!(should_use_runtime_config_json_values(
            Some("launcher"),
            None,
            "200"
        ));
        assert!(should_use_runtime_config_json_values(
            Some("native"),
            Some("200"),
            "200"
        ));
        assert!(!should_use_runtime_config_json_values(
            Some("native"),
            Some("100"),
            "200"
        ));
        assert!(!should_use_runtime_config_json_values(None, None, "200"));
    }

    #[test]
    fn terminal_output_decoder_preserves_utf8() {
        let mut decoder = TerminalOutputDecoder::new(TerminalEncoding::Utf8);
        assert_eq!(decoder.decode("半角ｶﾀｶﾅ ±".as_bytes()), "半角ｶﾀｶﾅ ±");
    }

    #[test]
    fn terminal_output_decoder_decodes_shift_jis_text() {
        let (bytes, _, had_errors) = SHIFT_JIS.encode("MEGAドライブ");
        assert!(!had_errors);
        let mut decoder = TerminalOutputDecoder::new(TerminalEncoding::ShiftJis);
        assert_eq!(decoder.decode(&bytes), "MEGAドライブ");
    }

    #[test]
    fn sync_broadcast_signature_rejects_tampered_commands() {
        let signing_key = "0123456789abcdef0123456789abcdef";
        let mut item = TerminalBroadcastItem {
            schema_version: 1,
            id: "test-1".to_string(),
            source_id: "test-source".to_string(),
            created_at: 100,
            expires_at: 200,
            text: "git status\r".to_string(),
            target_instance_ids: vec!["window-1".to_string()],
            key_event: None,
            signature: None,
        };
        let signature = sign_terminal_broadcast_item(&item, signing_key).expect("sign command");
        item.signature = Some(signature.clone());
        assert!(verify_terminal_broadcast_signature(
            &item,
            signing_key,
            &signature
        ));
        item.text = "rm -rf /\r".to_string();
        assert!(!verify_terminal_broadcast_signature(
            &item,
            signing_key,
            &signature
        ));
    }

    #[test]
    fn terminal_output_decoder_maps_shift_jis_half_width_kana() {
        let mut decoder = TerminalOutputDecoder::new(TerminalEncoding::Utf8);
        assert_eq!(decoder.decode(&[0xb6, 0xc0, 0xb6, 0xc5, b' ']), "ｶﾀｶﾅ ");
    }

    #[test]
    fn terminal_output_decoder_maps_invalid_utf8_half_width_kana_bytes() {
        let mut decoder = TerminalOutputDecoder::new(TerminalEncoding::Utf8);
        assert_eq!(decoder.decode(&[0xc2, b' ', 0xb1]), "ﾂ ｱ");
    }

    #[test]
    fn terminal_output_decoder_maps_iso2022_half_width_kana_across_chunks() {
        let mut decoder = TerminalOutputDecoder::new(TerminalEncoding::Utf8);
        assert_eq!(decoder.decode(&[0x1b, b'(']), "");
        assert_eq!(decoder.decode(&[b'I', 0x36, 0x40, 0x36, 0x45]), "ｶﾀｶﾅ");
        assert_eq!(decoder.decode(&[0x1b, b'(', b'B', b'A']), "A");
    }

    #[test]
    fn terminal_text_normalizer_converts_cursor_rows_to_newlines() {
        let mut normalizer = TerminalTextNormalizer::new();
        let text = normalizer.normalize("first\x1b[2;1Hsecond\x1b[4;5Hthird");
        assert_eq!(text, "first\nsecond\n    third");
    }

    #[test]
    fn terminal_text_normalizer_keeps_cursor_forward_as_spaces() {
        let mut normalizer = TerminalTextNormalizer::new();
        assert_eq!(normalizer.normalize("a\x1b[4Cb"), "a    b");
    }

    #[test]
    fn terminal_text_normalizer_composes_japanese_voicing_marks() {
        let mut normalizer = TerminalTextNormalizer::new();
        assert_eq!(
            normalizer.normalize("フ\u{309a}ロホ\u{309a}ート"),
            "プロポート"
        );
    }

    #[test]
    fn terminal_text_normalizer_preserves_half_width_kana() {
        let mut normalizer = TerminalTextNormalizer::new();
        assert_eq!(normalizer.normalize("ﾌﾟﾛｷｼｰ ﾍｯﾀﾞｰ"), "ﾌﾟﾛｷｼｰ ﾍｯﾀﾞｰ");
    }
}

impl Drop for TerminalSession {
    // Terminates the child shell when the session is dropped.
    fn drop(&mut self) {
        if let Ok(mut killer) = self.killer.lock() {
            let _ = killer.kill();
        }
    }
}
