{
  ...
}:
let
  generated-cfg-dir = "$GIT_ROOT/config/generated";
in
{
  imports = [
    ./js.nix
    ./rust.nix
    ./anvil.nix
    ./kafka.nix
  ];

  enterShell = ''
    git clean -fdx -- ${generated-cfg-dir}
  '';
}
