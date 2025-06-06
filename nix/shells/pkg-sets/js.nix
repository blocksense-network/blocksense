{ pkgs, lib, ... }:
let
  nodejs = pkgs.nodejs_24;
  yarn-berry = pkgs.yarn-berry_4;
  corepack = pkgs.corepack.override { inherit nodejs; };
in
{
  imports = [
    ./anvil.nix
  ];

  packages =
    [
      nodejs
      corepack
      yarn-berry.yarn-berry-fetcher
      pkgs.python3
    ]
    ++ lib.optionals pkgs.stdenv.isLinux [
      pkgs.udev
    ];
}
