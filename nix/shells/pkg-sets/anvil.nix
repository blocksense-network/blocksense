{
  pkgs,
  inputs',
  self',
  ...
}:
{
  packages =
    with pkgs;
    [
      # ...
    ]
    ++ lib.optionals stdenv.isLinux [ self'.legacyPackages.foundry ];
}
