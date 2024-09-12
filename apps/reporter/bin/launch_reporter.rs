use data_feeds::orchestrator::{get_validated_reporter_config, orchestrator};
use std::env;

use utils::build_info::{
    BLOCKSENSE_VERSION, GIT_BRANCH, GIT_DIRTY, GIT_HASH, GIT_HASH_SHORT, GIT_TAG,
    VERGEN_CARGO_DEBUG, VERGEN_CARGO_FEATURES, VERGEN_CARGO_OPT_LEVEL, VERGEN_RUSTC_SEMVER,
};

use feed_registry::registry::get_validated_feeds_config;
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

                let feeds_config_file =
                    get_config_file_path("FEEDS_CONFIG_DIR", "/feeds_config.json");
                let _reporter_config = get_validated_reporter_config();
                let _feeds_config = get_validated_feeds_config(feeds_config_file.as_str());

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
