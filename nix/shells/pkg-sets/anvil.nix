{
  pkgs,
  inputs',
  ...
}: {
  packages = with pkgs; [
    inputs'.ethereum-nix.packages.foundry
  ];
}
