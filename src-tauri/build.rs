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

// Embeds an override for reproducible packaging, or the checkout's HEAD for
// local contributor builds. The value is exposed by --version and Help.
fn build_commit(root: &Path) -> String {
    env::var("FPASOTERM_BUILD_COMMIT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| git_output(root, &["rev-parse", "HEAD"]))
        .unwrap_or_else(|| "unknown".to_string())
}

fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("Cargo manifest directory"));
    let repository_root = manifest_dir.parent().unwrap_or(&manifest_dir);
    println!("cargo:rerun-if-env-changed=FPASOTERM_BUILD_COMMIT");
    watch_git_revision(repository_root);
    println!(
        "cargo:rustc-env=FPASOTERM_BUILD_COMMIT={}",
        build_commit(repository_root)
    );
    tauri_build::build();
}
