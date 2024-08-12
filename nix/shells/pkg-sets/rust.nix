{ pkgs, self', ... }:
{
  env.SEQUENCER_CONFIG_DIR = "./apps/sequencer/";
  env.REPORTER_SECRET_KEY_FILE_PATH = "./apps/reporter";
  env.FEEDS_CONFIG_DIR = "./libs/feed_registry";

  packages =
    [ self'.legacyPackages.rustToolchain ]
    ++ (with pkgs; [
      openssl
      pkg-config
      cargo-tarpaulin
    ]);
}
