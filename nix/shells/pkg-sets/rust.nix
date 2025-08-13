{
  pkgs,
  self',
  ...
}:
{
  enterShell =
    # bash
    ''
      export SEQUENCER_CONFIG_DIR="$GIT_ROOT/apps/sequencer";
      export REPORTER_CONFIG_DIR="$GIT_ROOT/apps/reporter";
      export FEEDS_CONFIG_DIR="$GIT_ROOT/config";
      export REPORTER_SECRET_KEY_FILE_PATH="$GIT_ROOT/nix/test-environments/test-keys";
    '';

  packages = self'.packages.blocksense-rs.buildInputs ++ [
    self'.legacyPackages.cargoWrapped
    self'.legacyPackages.spinWrapped
    self'.legacyPackages.rustToolchain
    pkgs.cargo-tarpaulin
  ];
}
