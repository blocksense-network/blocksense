{ lib, ... }:
{
  imports = [
    ./shells
    ./pkgs
    ./modules
    ./test-environments
    ./machines
  ];

  flake.lib = {
    filesets = import ./filesets.nix { inherit lib; };
  }
  // (import ./lib lib);

  perSystem =
    {
      inputs',
      pkgs,
      self',
      ...
    }:
    let
      rustToolchain =
        with inputs'.fenix.packages;
        with latest;
        combine [
          cargo
          clippy
          rust-analyzer
          rust-src
          rustc
          rustfmt
          targets.wasm32-wasip1.latest.rust-std
        ];

      commonLibDeps = [
        pkgs.openssl
        pkgs.curl
        pkgs.rdkafka
      ];

      ldLibraryPath = lib.makeLibraryPath commonLibDeps;

      cargoWrapped = pkgs.writeShellScriptBin "cargo" ''
        export LD_LIBRARY_PATH="${ldLibraryPath}:$LD_LIBRARY_PATH"
        ${lib.getExe' rustToolchain "cargo"} "$@"
      '';

      # Minimally wrapped spin binary (to access shared libraries)
      # without nix-based plugin dir, for faster local development.
      spin = pkgs.writeShellScriptBin "spin" ''
        export LD_LIBRARY_PATH="${ldLibraryPath}:$LD_LIBRARY_PATH"
        ${lib.getExe' inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin "spin"} "$@"
      '';

      # Fully wrapped spin binary (with nix-based plugin dir).
      # For production use.
      spinWrapped = pkgs.writeShellScriptBin "spin" ''
        export SPIN_DATA_DIR="${self'.legacyPackages.spinPlugins.triggerOracle}"
        ${lib.getExe' spin "spin"} "$@"
      '';
    in
    {
      legacyPackages = {
        inherit
          rustToolchain
          commonLibDeps
          cargoWrapped
          spin
          spinWrapped
          ;
        inherit (inputs'.mcl-nixos-modules.checks) foundry;
      };
    };
}
