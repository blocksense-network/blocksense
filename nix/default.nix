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
    { inputs', ... }:
    {
      legacyPackages = {
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
      };
    };
}
