{ pkgs, lib, ... }:
let
  nodejs = pkgs.nodejs_23;
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
      pkgs.python3
    ]
    ++ lib.optionals pkgs.stdenv.isLinux [
      pkgs.udev
    ];
}
