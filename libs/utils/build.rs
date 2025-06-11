use vergen::{CargoBuilder, Emitter, RustcBuilder, SysinfoBuilder};

fn get_git_branch() -> String {
    use std::process::Command;

    let branch = Command::new("git")
        .arg("rev-parse")
        .arg("--abbrev-ref")
        .arg("HEAD")
        .output();
    if let Ok(branch_output) = branch {
        let branch_string = String::from_utf8_lossy(&branch_output.stdout);
        branch_string.to_string()
    } else {
        panic!("Can not get git branch: {}", branch.unwrap_err());
    }
}

fn get_git_hash() -> Option<String> {
    use std::process::Command;
    let commit = Command::new("git")
        .arg("rev-parse")
        .arg("--verify")
        .arg("HEAD")
        .output();
    if let Ok(commit_output) = commit {
        let commit_string = String::from_utf8_lossy(&commit_output.stdout);
        Some(commit_string.lines().next().unwrap_or("").to_string())
    } else {
        panic!("Can not get git commit: {commit:?}");
    }
}

fn git_top_level() -> Option<String> {
    use std::process::Command;
    let commit = Command::new("git")
        .arg("rev-parse")
        .arg("--show-toplevel")
        .output();
    if let Ok(commit_output) = commit {
        let commit_string = String::from_utf8_lossy(&commit_output.stdout);
        Some(commit_string.lines().next().unwrap_or("").to_string())
    } else {
        panic!("Can not get git top level: {commit:?}");
    }
}

pub struct GitDescription {
    pub tag: String,
    pub commit_sha: String,
    pub num_commits_since_tag: i32,
    pub dirty: String,
}

fn get_git_description() -> Option<GitDescription> {
    use std::process::Command;
    let git_description = Command::new("git")
        .arg("describe")
        .arg("--tags")
        .arg("--long")
        .arg("--always")
        .arg("--dirty")
        .output();
    // Example outputs:
    // eb97797
    // eb97797-dirty
    if let Ok(desc_output) = git_description {
        let desc_string = String::from_utf8_lossy(&desc_output.stdout);
        let parts: Vec<_> = desc_string.split('-').collect();
        if parts.len() <= 2 {
            let commit_sha = parts[0].to_string();
            let tag = "No tags".to_string();
            let num_commits_since_tag = 0;
            let dirty = if parts.len() == 1 {
                "".to_string()
            } else {
                parts[1].to_string()
            };
            return Some(GitDescription {
                tag,
                commit_sha,
                num_commits_since_tag,
                dirty,
            });
        }
        let tag = parts[0].to_string();
        let num_commits_since_tag = parts[1].parse::<i32>().unwrap();
        let commit_sha = parts[2][1..].to_string();

        let dirty = if parts.len() > 3 {
            parts[3].to_string()
        } else {
            "".to_string()
        };
        Some(GitDescription {
            tag,
            commit_sha,
            num_commits_since_tag,
            dirty,
        })
    } else {
        None
    }
}

fn main() {
    //let build = BuildBuilder::all_build().expect("failed to obtain build information");
    let cargo = CargoBuilder::all_cargo().expect("failed to obtain cargo information");
    let rustc = RustcBuilder::all_rustc().expect("failed to obtain rustc information");
    let si = SysinfoBuilder::default()
        .name(true)
        .os_version(true)
        .user(false)
        .memory(true)
        .cpu_vendor(true)
        .cpu_core_count(true)
        .cpu_name(true)
        .cpu_brand(true)
        .cpu_frequency(true)
        .build()
        .expect("failed to obtain system information");

    Emitter::default()
        //.add_instructions(&build)
        //.expect("failed to add build information")
        .add_instructions(&cargo)
        .expect("failed to add cargo information")
        .add_instructions(&rustc)
        .expect("failed to add rustc information")
        .add_instructions(&si)
        .expect("failed to add system information")
        .emit()
        .expect("failed to emit information frm build.rs");
    if let Some(git_hash) = get_git_hash() {
        println!("cargo:rustc-env=GIT_HASH={git_hash}");
    }
    if let Some(top_level) = git_top_level() {
        let git_branch = get_git_branch();
        // in deattached git state, git branch should be empty
        if !git_branch.is_empty() {
            println!("cargo:rustc-env=GIT_BRANCH={git_branch}");
            println!("cargo:rerun-if-changed={top_level}/.git/refs/heads/{git_branch}");
        } else {
            println!("cargo:rustc-env=GIT_BRANCH=DETACHED HEAD");
        }
        println!("cargo:rerun-if-changed={top_level}/.git/HEAD");
    }

    if let Some(git_description) = get_git_description() {
        println!("cargo:rustc-env=GIT_TAG={}", git_description.tag);
        println!(
            "cargo:rustc-env=GIT_HASH_SHORT={}",
            git_description.commit_sha
        );
        println!(
            "cargo:rustc-env=GIT_NUM_COMMITS_SINCE_TAG={}",
            git_description.num_commits_since_tag
        );
        println!("cargo:rustc-env=GIT_DIRTY={}", git_description.dirty);
    }
}
