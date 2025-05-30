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
    REPORTER_CONFIG_DIR = config.devenv.root + "/apps/reporter";
    FEEDS_CONFIG_DIR = config.devenv.root + "/config";
    REPORTER_SECRET_KEY_FILE_PATH = config.devenv.root + "/nix/test-environments/test-keys";
    LD_LIBRARY_PATH = lib.makeLibraryPath self'.legacyPackages.commonLibDeps;
  };

  enterShell = ''
    if [ "''${CMC_API_KEY:-}" != "" ]; then
      echo "$CMC_API_KEY" > nix/test-environments/test-keys/CMC_API_KEY
    fi

    if [ "''${YH_FINANCE_API_KEY:-}" != "" ]; then
      echo "$YH_FINANCE_API_KEY" > nix/test-environments/test-keys/YH_FINANCE_API_KEY
    fi
  '';

  packages = self'.packages.blocksense-rs.buildInputs ++ [
    self'.legacyPackages.cargoWrapped
    inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin
    self'.legacyPackages.rustToolchain
    pkgs.cargo-tarpaulin
  ];
}
