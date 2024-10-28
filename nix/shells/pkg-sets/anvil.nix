{ pkgs, self', ... }:
{
  packages =
    with pkgs;
    [
      # ...
    ]
    ++ lib.optionals stdenv.isLinux [ self'.legacyPackages.foundry ];
}
