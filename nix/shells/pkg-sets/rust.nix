{
  pkgs,
  inputs',
  ...
}:
with pkgs; [
  rustc
  cargo
  openssl
  pkg-config
]
