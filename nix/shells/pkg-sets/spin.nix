{ pkgs, inputs', ... }:
{
  packages = with pkgs; [
    inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin
    coreutils
  ];
}
