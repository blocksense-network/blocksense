//! Build information for the Blocksense CLI.

/// The version of the Blocksense CLI.
pub const BLOCKSENSE_VERSION: &str = env!("CARGO_PKG_VERSION");

pub const GIT_HASH: &str = env!("GIT_HASH");
pub const GIT_TAG: &str = env!("GIT_TAG");
pub const GIT_HASH_SHORT: &str = env!("GIT_HASH_SHORT");
pub const GIT_NUM_COMMITS_SINCE_TAG: &str = env!("GIT_NUM_COMMITS_SINCE_TAG");
pub const GIT_DIRTY: &str = env!("GIT_DIRTY");
pub const GIT_BRANCH: &str = env!("GIT_BRANCH");

pub const VERGEN_CARGO_DEBUG: &str = env!("VERGEN_CARGO_DEBUG");
pub const VERGEN_CARGO_FEATURES: &str = env!("VERGEN_CARGO_FEATURES");
pub const VERGEN_CARGO_OPT_LEVEL: &str = env!("VERGEN_CARGO_OPT_LEVEL");
pub const VERGEN_CARGO_TARGET_TRIPLE: &str = env!("VERGEN_CARGO_TARGET_TRIPLE");
pub const VERGEN_CARGO_DEPENDENCIES: &str = env!("VERGEN_CARGO_DEPENDENCIES");

pub const VERGEN_RUSTC_CHANNEL: &str = env!("VERGEN_RUSTC_CHANNEL");
pub const VERGEN_RUSTC_COMMIT_DATE: &str = env!("VERGEN_RUSTC_COMMIT_DATE");
pub const VERGEN_RUSTC_COMMIT_HASH: &str = env!("VERGEN_RUSTC_COMMIT_HASH");
pub const VERGEN_RUSTC_HOST_TRIPLE: &str = env!("VERGEN_RUSTC_HOST_TRIPLE");
pub const VERGEN_RUSTC_LLVM_VERSION: &str = env!("VERGEN_RUSTC_LLVM_VERSION");
pub const VERGEN_RUSTC_SEMVER: &str = env!("VERGEN_RUSTC_SEMVER");

pub const VERGEN_SYSINFO_NAME: &str = env!("VERGEN_SYSINFO_NAME");
pub const VERGEN_SYSINFO_OS_VERSION: &str = env!("VERGEN_SYSINFO_OS_VERSION");
pub const VERGEN_SYSINFO_TOTAL_MEMORY: &str = env!("VERGEN_SYSINFO_TOTAL_MEMORY");
pub const VERGEN_SYSINFO_CPU_VENDOR: &str = env!("VERGEN_SYSINFO_CPU_VENDOR");
pub const VERGEN_SYSINFO_CPU_CORE_COUNT: &str = env!("VERGEN_SYSINFO_CPU_CORE_COUNT");
pub const VERGEN_SYSINFO_CPU_NAME: &str = env!("VERGEN_SYSINFO_CPU_NAME");
pub const VERGEN_SYSINFO_CPU_BRAND: &str = env!("VERGEN_SYSINFO_CPU_BRAND");
pub const VERGEN_SYSINFO_CPU_FREQUENCY: &str = env!("VERGEN_SYSINFO_CPU_FREQUENCY");

#[derive(Debug)]
pub struct BuildInfo {
    pub version: String,
    pub git_hash: String,
    pub git_tag: String,
    pub git_hash_short: String,
    pub git_num_commits_since_tag: String,
    pub git_dirty: String,
    pub git_branch: String,

    pub cargo_debug: String,
    pub cargo_features: String,
    pub cargo_opt_level: String,
    #[allow(dead_code)]
    pub cargo_target_triple: String,

    pub rustc_channel: String,
    pub rustc_commit_date: String,
    pub rustc_host_triple: String,
    pub rustc_llvm_version: String,
    pub rustc_sem_version: String,
    #[allow(dead_code)]
    pub sysinfo_name: String,
    pub sysinfo_os_version: String,
    #[allow(dead_code)]
    pub sysinfo_total_memory: String,
    #[allow(dead_code)]
    pub sysinfo_cpu_vendor: String,
    #[allow(dead_code)]
    pub sysinfo_cpu_core_count: String,
    #[allow(dead_code)]
    pub sysinfo_cpu_name: String,
    #[allow(dead_code)]
    pub sysinfo_cpu_brand: String,
    #[allow(dead_code)]
    pub sysinfo_cpu_frequency: String,
}

/// Returns build information, similar to: 0.1.0.
impl Default for BuildInfo {
    fn default() -> Self {
        BuildInfo {
            version: BLOCKSENSE_VERSION.to_string(),
            git_hash: GIT_HASH.to_string(),
            git_tag: GIT_TAG.to_string(),
            git_hash_short: GIT_HASH_SHORT.to_string(),
            git_num_commits_since_tag: GIT_NUM_COMMITS_SINCE_TAG.to_string(),
            git_dirty: GIT_DIRTY.to_string(),
            git_branch: GIT_BRANCH.to_string(),

            cargo_debug: VERGEN_CARGO_DEBUG.to_string(),
            cargo_features: VERGEN_CARGO_FEATURES.to_string(),
            cargo_opt_level: VERGEN_CARGO_OPT_LEVEL.to_string(),
            cargo_target_triple: VERGEN_CARGO_TARGET_TRIPLE.to_string(),
            rustc_channel: VERGEN_RUSTC_CHANNEL.to_string(),
            rustc_commit_date: VERGEN_RUSTC_COMMIT_DATE.to_string(),
            rustc_host_triple: VERGEN_RUSTC_HOST_TRIPLE.to_string(),
            rustc_llvm_version: VERGEN_RUSTC_LLVM_VERSION.to_string(),
            rustc_sem_version: VERGEN_RUSTC_SEMVER.to_string(),

            sysinfo_name: VERGEN_SYSINFO_NAME.to_string(),
            sysinfo_os_version: VERGEN_SYSINFO_OS_VERSION.to_string(),

            sysinfo_total_memory: VERGEN_SYSINFO_TOTAL_MEMORY.to_string(),
            sysinfo_cpu_vendor: VERGEN_SYSINFO_CPU_VENDOR.to_string(),
            sysinfo_cpu_core_count: VERGEN_SYSINFO_CPU_CORE_COUNT.to_string(),
            sysinfo_cpu_name: VERGEN_SYSINFO_CPU_NAME.to_string(),
            sysinfo_cpu_brand: VERGEN_SYSINFO_CPU_BRAND.to_string(),
            sysinfo_cpu_frequency: VERGEN_SYSINFO_CPU_FREQUENCY.to_string(),
        }
    }
}
