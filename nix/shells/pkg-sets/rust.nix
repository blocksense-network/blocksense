{
  pkgs,
  self',
  ...
}: {
  env.SEQUENCER_CONFIG_DIR = "./apps/sequencer/";

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
