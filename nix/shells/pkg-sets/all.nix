{
  pkgs,
  self,
  config,
  lib,
  ...
}:
let
  inherit (pkgs.hostPlatform) isLinux;
in
{
  imports = [
    ./js.nix
    ./rust.nix
    ./kafka.nix

    self.nixosModules.blocksense-process-compose
    ../../test-environments/example-setup-01.nix
  ] ++ lib.optional isLinux ./anvil.nix;

  enterShell = ''
    ln -fs ${config.process.managers.process-compose.configFile} ${config.devenv.root}/process-compose.yml
  '';
}
