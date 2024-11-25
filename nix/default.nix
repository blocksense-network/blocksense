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
          targets.wasm32-wasi.latest.rust-std
        ];

      ldLibraryPath = lib.makeLibraryPath [
        pkgs.openssl
        pkgs.curl
      ];

      cargoWrapped = pkgs.writeShellScriptBin "cargo" ''
        export LD_LIBRARY_PATH="${ldLibraryPath}:$LD_LIBRARY_PATH"
        ${lib.getExe' rustToolchain "cargo"} "$@"
      '';
    in
    {
      legacyPackages = {
        inherit rustToolchain cargoWrapped;
        inherit (inputs'.mcl-nixos-modules.checks) foundry;
      };
    };
}
