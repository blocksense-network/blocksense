{
  pkgs,
  inputs',
  ...
}: {
  packages = with pkgs; [
    (inputs'.fenix.packages.stable.withComponents [
      "cargo"
      "clippy"
      "rust-src"
      "rust-analyzer"
      "rustc"
      "rustfmt"
    ])
    openssl
    pkg-config
  ];
}
