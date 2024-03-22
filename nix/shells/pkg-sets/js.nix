{
  pkgs,
  inputs',
  ...
}: let
  nodejs = pkgs.nodejs_21;
  oldYarn = pkgs.yarn.override {inherit nodejs;};
  yarn = pkgs.yarn-berry.override {
    inherit nodejs;
    yarn = oldYarn;
  };
in [
  nodejs
  yarn
]
