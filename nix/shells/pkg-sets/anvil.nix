{
  pkgs,
  inputs',
  ...
}: {
  packages = with pkgs;
    [
      # ...
    ]
    ++ lib.optionals stdenv.isLinux [
      inputs'.ethereum-nix.packages.foundry
    ];
}
