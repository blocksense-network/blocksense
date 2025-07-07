{
  pkgs,
  self',
  config,
  lib,
  inputs',
  ...
}:
{
  env = {
    SEQUENCER_CONFIG_DIR = config.devenv.root + "/apps/sequencer";
    ETH_RELAYER_CONFIG_DIR = config.devenv.root + "/apps/eth_relayer";
    REPORTER_CONFIG_DIR = config.devenv.root + "/apps/reporter";
    FEEDS_CONFIG_DIR = config.devenv.root + "/config";
    REPORTER_SECRET_KEY_FILE_PATH = config.devenv.root + "/nix/test-environments/test-keys";
    LD_LIBRARY_PATH = lib.makeLibraryPath self'.legacyPackages.commonLibDeps;
  };

  packages = self'.packages.blocksense-rs.buildInputs ++ [
    self'.legacyPackages.cargoWrapped
    inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin
    self'.legacyPackages.rustToolchain
    pkgs.cargo-tarpaulin
  ];
}
