{
  lib,
  self,
  inputs,
  withSystem,
  ...
}:
{
  flake.nixosModules =
    let
      mkModule =
        backend:
        { config, pkgs, ... }:
        let
          cfg = config.services.blocksense;

          inherit (withSystem pkgs.stdenv.hostPlatform.system (args: args)) inputs' self';

          specialArgs = {
            inherit
              pkgs
              self
              self'
              inputs
              inputs'
              cfg
              lib
              ;
          };
        in
        {
          options.services.blocksense = import ./module-opts specialArgs;

          imports = [
            ./assertions.nix
            (import backend specialArgs)
          ];
        };
    in
    {
      blocksense-systemd = mkModule ./backends/systemd.nix;
      blocksense-process-compose = mkModule ./backends/process-compose.nix;
    };
}
