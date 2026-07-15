#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WindowEvent};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConfig {
    config: Config,
    config_dir: String,
    config_path: String,
    plugin_urls: Vec<PluginUrl>,
    window_state_path: String,
    diagnostics: Option<DiagnosticsConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Config {
    window: WindowConfig,
    terminal: serde_json::Value,
    ime: serde_json::Value,
    plugins: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowConfig {
    width: u32,
    height: u32,
    min_width: u32,
    min_height: u32,
    background_color: String,
    theme_source: String,
    frame: bool,
    remember_bounds: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct PluginUrl {
    name: String,
    url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsConfig {
    debug_keys: bool,
    console_diagnostics: bool,
    opaque_terminal: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
struct TerminalSize {
    cols: u16,
    rows: u16,
}

#[derive(Debug, Clone, Serialize)]
struct TerminalExit {
    exit_code: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowBoundsRequest {
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
}

#[derive(Default)]
struct AppState {
    terminal: Mutex<Option<TerminalSession>>,
    diagnostics: Mutex<VecDeque<String>>,
}

fn main() {
    if env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err()
        && env::var("FPASOTERM_DISABLE_DMABUF").as_deref() == Ok("1")
    {
        env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            let config = runtime_config();
            if let Some(window) = app.get_webview_window("main") {
                let restore_size =
                    PhysicalSize::new(config.config.window.width, config.config.window.height);
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
                install_window_state_persistence(
                    window.clone(),
                    config.window_state_path.clone(),
                    config.config.window.remember_bounds,
                );
                schedule_window_size_restore(app.handle().clone(), window, restore_size);
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
            diagnostics_copy,
            diagnostics_path,
            diagnostics_log,
            config_get,
            window_close,
            window_start_drag,
            window_save_bounds,
            window_get_bounds,
            window_set_bounds,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run fpasoterm");
}

fn schedule_window_size_restore(
    app: AppHandle,
    window: tauri::WebviewWindow,
    size: PhysicalSize<u32>,
) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(350));
        let _ = app.run_on_main_thread(move || {
            let _ = window.set_size(size);
        });
    });
}

fn install_window_state_persistence(
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
            }
        }
    });
}

fn save_window_state(window: &tauri::WebviewWindow, state_path: &str) -> Result<(), String> {
    let size = window.outer_size().map_err(|error| error.to_string())?;
    save_window_size(size, state_path)
}

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

fn window_state_path() -> String {
    runtime_config().window_state_path
}

fn runtime_config() -> RuntimeConfig {
    env::var("FPASOTERM_RUNTIME_CONFIG_JSON")
        .ok()
        .and_then(|value| serde_json::from_str(&value).ok())
        .unwrap_or_else(default_runtime_config)
}

fn default_runtime_config() -> RuntimeConfig {
    let home = home_dir();
    let config_dir = format!("{home}/.config/fpasoterm/User");
    let config_path = env::var("FPASOTERM_CONFIG_PATH")
        .ok()
        .or_else(|| cli_option_value("--config"))
        .unwrap_or_else(|| format!("{config_dir}/config.toml"));
    let window_state_path = format!("{config_dir}/window-state.json");
    let mut window = WindowConfig {
        width: 1000,
        height: 680,
        min_width: 420,
        min_height: 260,
        background_color: "rgba(0, 0, 0, 0)".to_string(),
        theme_source: "system".to_string(),
        frame: false,
        remember_bounds: true,
    };
    if let Some((width, height)) = read_saved_window_size(&window_state_path) {
        window.width = width;
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
        },
        config_dir: config_dir.clone(),
        config_path,
        plugin_urls: Vec::new(),
        window_state_path,
        diagnostics: Some(DiagnosticsConfig {
            debug_keys: env::var("FPASOTERM_DEBUG_KEYS").as_deref() == Ok("1"),
            console_diagnostics: env::var("FPASOTERM_CONSOLE_DIAGNOSTICS").as_deref() == Ok("1"),
            opaque_terminal: Some(
                env::var("FPASOTERM_DEBUG_OPAQUE_TERMINAL").as_deref() == Ok("1"),
            ),
        }),
    }
}

fn home_dir() -> String {
    env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string())
}

fn read_configured_shell(config_path: &str) -> Option<String> {
    let value: toml::Value = toml::from_str(&fs::read_to_string(config_path).ok()?).ok()?;
    value
        .get("terminal")?
        .get("shell")?
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn cli_option_value(flag: &str) -> Option<String> {
    let equals_prefix = format!("{flag}=");
    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == flag {
            return args
                .next()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());
        }
        if let Some(value) = arg.strip_prefix(&equals_prefix) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

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
    if env::var("FPASOTERM_CONSOLE_DIAGNOSTICS").as_deref() == Ok("1") {
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

fn configured_shell(config: &Config) -> Option<String> {
    config
        .terminal
        .get("shell")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn shell_command(config: &Config) -> String {
    if let Ok(shell) = env::var("FPASOTERM_SHELL") {
        if !shell.trim().is_empty() {
            return shell;
        }
    }
    if let Some(shell) = cli_option_value("--shell") {
        return shell;
    }
    if let Some(shell) = configured_shell(config) {
        return shell;
    }
    if cfg!(windows) {
        env::var("ComSpec").unwrap_or_else(|_| "powershell.exe".to_string())
    } else if cfg!(target_os = "macos") {
        macos_login_shell().unwrap_or_else(|| "/bin/zsh".to_string())
    } else {
        env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

#[tauri::command]
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
    command.env("TERM_PROGRAM", "fpasoterm");

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
    let writer_for_state = Arc::clone(&writer);
    let app_for_reader = app.clone();
    let app_for_wait = app.clone();

    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    if env::var("FPASOTERM_CONSOLE_DIAGNOSTICS").as_deref() == Ok("1") {
                        eprintln!("terminal_read bytes={read}");
                    }
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

    if let Ok(command) = env::var("FPASOTERM_START_COMMAND") {
        if !command.trim().is_empty() {
            if let Ok(mut writer) = writer.lock() {
                let _ = writeln!(writer, "{command}\r");
            }
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
fn terminal_resize(state: State<AppState>, size: TerminalSize) -> Result<(), String> {
    let terminal = state.terminal.lock().map_err(|error| error.to_string())?;
    if let Some(session) = terminal.as_ref() {
        if env::var("FPASOTERM_CONSOLE_DIAGNOSTICS").as_deref() == Ok("1") {
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

#[tauri::command]
fn diagnostics_copy(state: State<AppState>) -> Result<String, String> {
    let diagnostics = state
        .diagnostics
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(diagnostics.iter().cloned().collect::<Vec<_>>().join("\n"))
}

#[tauri::command]
fn diagnostics_path() -> String {
    "diagnostics are kept in memory by the Tauri runtime".to_string()
}

#[tauri::command]
fn diagnostics_log(app: AppHandle, message: String) {
    append_diagnostic(&app, &message);
}

#[tauri::command]
fn config_get() -> RuntimeConfig {
    runtime_config()
}

#[tauri::command]
fn window_close(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

#[tauri::command]
fn window_start_drag(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_save_bounds(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;
    save_window_state(&window, &window_state_path())
}

#[tauri::command]
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
    fn drop(&mut self) {
        if let Ok(mut killer) = self.killer.lock() {
            let _ = killer.kill();
        }
    }
}
