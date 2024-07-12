{
  pkgs,
  self',
  ...
}: {
  env.SEQUENCER_CONFIG_DIR = "./apps/sequencer/";
  env.REPORTER_SECRET_KEY_FILE_PATH = "./apps/reporter";

  packages =
    [
      self'.legacyPackages.rustToolchain
    ]
    ++ (with pkgs; [
      openssl
      pkg-config
      cargo-tarpaulin
    ]);
}
