{
  self,
  config,
  ...
}:
{
  imports = [
    ./js.nix
    ./rust.nix
    ./anvil.nix
    ./kafka.nix
  ];
}
