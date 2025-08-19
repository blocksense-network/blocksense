{ lib, ... }:
{
  imports = [
    ./shells
    ./pkgs
    ./modules
    ./test-environments
  ];

  flake.lib = {
    filesets = import ./filesets.nix { inherit lib; };
  } // (import ./lib lib);

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

      spinUnwrapped = inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin;

      spinWrapped = pkgs.writeShellScriptBin "spin" ''
        export LD_LIBRARY_PATH="${ldLibraryPath}:$LD_LIBRARY_PATH"
        export SPIN_DATA_DIR="${self'.legacyPackages.spinPlugins.triggerOracle}"
        ${lib.getExe' spinUnwrapped "spin"} "$@"
      '';
    in
    {
      legacyPackages = {
        inherit
          rustToolchain
          commonLibDeps
          cargoWrapped
          spinWrapped
          spinUnwrapped
          ;
        inherit (inputs'.mcl-nixos-modules.checks) foundry;
      };
    };
}
