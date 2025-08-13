{
  lib,
  self',
  ...
}:
let
  generated-cfg-dir = "$GIT_ROOT/config/generated";
in
{
  env = {
    LD_LIBRARY_PATH = lib.makeLibraryPath self'.legacyPackages.commonLibDeps;
  };

  imports = [
    ./all.nix
  ];

  enterShell = ''
    git clean -fdx -- ${generated-cfg-dir}
  '';
}
