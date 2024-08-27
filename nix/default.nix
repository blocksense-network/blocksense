{ lib, inputs, ... }:
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
    { inputs', system, ... }:
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

        foundry =
          let
            # https://github.com/ethereum/solidity/issues/12291
            foundrySystem = if system == "aarch64-darwin" then "x86_64-darwin" else system;
          in
          inputs.mcl-nixos-modules.checks.${foundrySystem}.foundry;
      };
    };
}
