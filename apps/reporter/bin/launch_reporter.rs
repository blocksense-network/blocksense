use config::{get_validated_config, AllFeedsConfig, ReporterConfig};
use data_feeds::orchestrator::orchestrator;
use std::env;

use utils::{
    build_info::{
        BLOCKSENSE_VERSION, GIT_BRANCH, GIT_DIRTY, GIT_HASH, GIT_HASH_SHORT, GIT_TAG,
        VERGEN_CARGO_DEBUG, VERGEN_CARGO_FEATURES, VERGEN_CARGO_OPT_LEVEL, VERGEN_RUSTC_SEMVER,
    },
    constants::{FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE, REPORTER_CONFIG_DIR, REPORTER_CONFIG_FILE},
};

use utils::get_config_file_path;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let args = env::args().skip(1);
    for arg in args {
        match &arg[..] {
            "--validate-config" => {
                env::set_var("RUST_LOG", "INFO");
                tracing_subscriber::fmt::init();
                println!("Validating configuration for version:");
                println!("version => {BLOCKSENSE_VERSION}");
                println!("git_hash => {GIT_HASH}");
                println!("git_hash_short => {GIT_HASH_SHORT}");
                println!("git_dirty => {GIT_DIRTY}");
                println!("git_branch => {GIT_BRANCH}");
                println!("git_tag => {GIT_TAG}");
                println!("debug => {VERGEN_CARGO_DEBUG}");
                println!("features => {VERGEN_CARGO_FEATURES}");
                println!("optimizations => {VERGEN_CARGO_OPT_LEVEL}");
                println!("compiler => {VERGEN_RUSTC_SEMVER}");

                let reporter_config_file =
                    get_config_file_path(REPORTER_CONFIG_DIR, REPORTER_CONFIG_FILE);
                let feeds_config_file = get_config_file_path(FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE);
                let _reporter_config =
                    get_validated_config::<ReporterConfig>(&reporter_config_file, "ReporterConfig");
                let _feeds_config =
                    get_validated_config::<AllFeedsConfig>(&feeds_config_file, "AllFeedsConfig");

                return std::io::Result::Ok(());
            }
            "--help" => {
                println!("Usage:");
                println!("reporter [options] [args]");
                println!(" ");
                println!("OPTIONS");
                println!("--help                     show list of command-line options");
                println!("--validate-config          validate configuration, print used config files paths and terminate");

                return Ok(());
            }
            _ => {
                if arg.starts_with('-') {
                    println!("Unknown argument {}", arg);
                } else {
                    println!("Unknown positional argument {}", arg);
                }
            }
        }
    }
    orchestrator().await;
    Ok(())
}
