{ pkgs, ... }:
let
  nodejs = pkgs.nodejs_22;
  oldYarn = pkgs.yarn.override { inherit nodejs; };
  yarn = pkgs.yarn-berry.override {
    inherit nodejs;
    yarn = oldYarn;
  };
in
{
  packages = [
    nodejs
    yarn
  ];
}
