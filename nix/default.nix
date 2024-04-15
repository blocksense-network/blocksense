{...}: {
  imports = [./shells];
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
