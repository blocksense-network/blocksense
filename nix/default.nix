{lib, ...}: {
  imports = [./shells ./pkgs];

  flake.lib = {
    filesets = import ./filesets.nix {inherit lib;};
  };

  perSystem = {inputs', ...}: {
    legacyPackages = {
      rustToolchain = with inputs'.fenix.packages;
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
