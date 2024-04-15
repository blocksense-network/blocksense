{lib, ...}: {
  imports = [./shells ./pkgs];

  flake.lib = {
    filesets = import ./filesets.nix {inherit lib;};
  };

  perSystem = {inputs', ...}: {
    legacyPackages = {
      rustToolchain = inputs'.fenix.packages.stable.withComponents [
        "cargo"
        "clippy"
        "rust-src"
        "rust-analyzer"
        "rustc"
        "rustfmt"
      ];
    };
  };
}
