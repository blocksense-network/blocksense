{
  pkgs,
  self',
  config,
  inputs',
  ...
}:
{
  env = {
    SEQUENCER_CONFIG_DIR = config.devenv.root + "/apps/sequencer";
    REPORTER_CONFIG_DIR = config.devenv.root + "/apps/reporter";
    FEEDS_CONFIG_DIR = config.devenv.root + "/config";
    REPORTER_SECRET_KEY_FILE_PATH = config.devenv.root + "/nix/test-environments/test-keys";
  };

  packages = self'.packages.blocksense-rs.buildInputs ++ [
    self'.legacyPackages.cargoWrapped
    inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin
    self'.legacyPackages.rustToolchain
    pkgs.cargo-tarpaulin
  ];
}
