{
  pkgs,
  lib,
  inputs',
  self',
  ...
}:
let
  nodejs = pkgs.nodejs_24;
  corepack = pkgs.corepack.override { inherit nodejs; };
in
{
  imports = [
    ./anvil.nix
  ];

  packages = [
    nodejs
    corepack
    pkgs.python3
    inputs'.mcl-blockchain.packages.eradicate2
    self'.packages.wit-converter
  ]
  ++ lib.optionals pkgs.stdenv.isLinux [
    pkgs.udev
  ];
}
