{ pkgs, lib, ... }:
let
  nodejs = pkgs.nodejs_22;
  corepack = pkgs.corepack.override { inherit nodejs; };
in
{
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
