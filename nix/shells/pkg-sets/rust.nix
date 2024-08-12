{
  pkgs,
  self',
  config,
  ...
}: {
  env.SEQUENCER_CONFIG_DIR = config.devenv.root + "/apps/sequencer/";
  env.REPORTER_SECRET_KEY_FILE_PATH = config.devenv.root + "/apps/reporter";
  env.FEEDS_CONFIG_DIR = config.devenv.root + "/libs/feed_registry";

  packages =
    [self'.legacyPackages.rustToolchain]
    ++ (with pkgs; [
      openssl
      pkg-config
      cargo-tarpaulin
    ]);
}
