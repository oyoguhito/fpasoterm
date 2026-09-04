use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

// Runs git from the repository root and returns trimmed standard output.
fn git_output(root: &Path, arguments: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(arguments)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8(output.stdout).ok()?;
    let value = value.trim().to_string();
    (!value.is_empty()).then_some(value)
}

// Registers HEAD and its active ref so a branch switch rebuilds the commit id.
fn watch_git_revision(root: &Path) {
    let Some(head_path) = git_output(root, &["rev-parse", "--git-path", "HEAD"]) else {
        return;
    };
    let head_path = root.join(head_path);
    println!("cargo:rerun-if-changed={}", head_path.display());

    if let Ok(head) = fs::read_to_string(&head_path) {
        if let Some(reference) = head.trim().strip_prefix("ref: ") {
            if let Some(reference_path) = git_output(root, &["rev-parse", "--git-path", reference])
            {
                println!(
                    "cargo:rerun-if-changed={}",
                    root.join(reference_path).display()
                );
            }
        }
    }
    if let Some(packed_refs) = git_output(root, &["rev-parse", "--git-path", "packed-refs"]) {
        println!(
            "cargo:rerun-if-changed={}",
            root.join(packed_refs).display()
        );
    }
}

// jj keeps the working-copy commit outside Git's HEAD. Watch its state when
// present so contributor builds refresh the version shown by Help and --version.
fn watch_jj_revision(root: &Path) {
    for relative_path in [".jj/working_copy/tree_state", ".jj/repo/op_heads"] {
        let path = root.join(relative_path);
        if path.exists() {
            println!("cargo:rerun-if-changed={}", path.display());
        }
    }
}

// Tauri bundles frontendDist from outside Cargo's normal source tree. Watch
// every renderer asset so a cached native build cannot retain an older menu or
// Help panel after a checkout changes only HTML, JavaScript, or CSS.
fn watch_frontend_assets(path: &Path) {
    println!("cargo:rerun-if-changed={}", path.display());
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            watch_frontend_assets(&entry_path);
        } else {
            println!("cargo:rerun-if-changed={}", entry_path.display());
        }
    }
}

// Returns the current jj commit only in a jj checkout. Release archives and
// regular Git clones intentionally continue through the Git fallback below.
fn jj_working_copy_commit(root: &Path) -> Option<String> {
    if !root.join(".jj").is_dir() {
        return None;
    }
    let home = env::var_os("HOME").map(PathBuf::from);
    let mise_data = env::var_os("MISE_DATA_DIR")
        .map(PathBuf::from)
        .or_else(|| home.as_ref().map(|path| path.join(".local/share/mise")));
    let mut candidates = Vec::new();
    if let Some(path) = env::var_os("JJ").map(PathBuf::from) {
        candidates.push(path);
    }
    if let Some(path) = mise_data {
        candidates.push(path.join("shims/jj"));
    }
    if let Some(path) = home {
        candidates.push(path.join(".cargo/bin/jj"));
    }
    let jj_program = candidates
        .into_iter()
        .find(|path| path.is_file())
        .unwrap_or_else(|| PathBuf::from("jj"));
    let output = Command::new(jj_program)
        .current_dir(root)
        .args(["log", "-r", "@", "--no-graph", "-T", "commit_id"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8(output.stdout).ok()?;
    let value = value.trim().to_string();
    (!value.is_empty()).then_some(value)
}

// Embeds an override for reproducible packaging, the jj working copy for
// contributor builds, or the checkout's Git HEAD. The value is shown by Help.
fn build_commit(root: &Path) -> String {
    env::var("FPASOTERM_BUILD_COMMIT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| jj_working_copy_commit(root))
        .or_else(|| git_output(root, &["rev-parse", "HEAD"]))
        .unwrap_or_else(|| "unknown".to_string())
}

fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("Cargo manifest directory"));
    let repository_root = manifest_dir.parent().unwrap_or(&manifest_dir);
    println!("cargo:rerun-if-env-changed=FPASOTERM_BUILD_COMMIT");
    watch_git_revision(repository_root);
    watch_jj_revision(repository_root);
    watch_frontend_assets(&repository_root.join("src/renderer"));
    println!(
        "cargo:rustc-env=FPASOTERM_BUILD_COMMIT={}",
        build_commit(repository_root)
    );
    tauri_build::build();
}
