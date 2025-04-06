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

          config.services.blocksense = {
            sequencer.providers = lib.mkIf (cfg.anvil != { }) (
              lib.mapAttrs (_name: value: {
                "url" = lib.mkDefault "http://127.0.0.1:${toString value.port}";
              }) cfg.anvil
            );
          };

          imports = [ (import backend specialArgs) ];
        };
    in
    {
      blocksense-systemd = mkModule ./backends/systemd.nix;
      blocksense-process-compose = mkModule ./backends/process-compose.nix;
    };
}
