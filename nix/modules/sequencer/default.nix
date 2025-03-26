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
          inherit (config.services) blocksense;

          specialArgs = {
            inherit
              pkgs
              self
              self'
              inputs
              inputs'
              blocksense
              ;
          };

          mkSubmodule =
            module:
            lib.types.submoduleWith {
              inherit specialArgs;
              modules = [ module ];
            };
        in
        with lib;
        {
          options.services.blocksense = {
            enable = mkEnableOption (mdDoc ''
              Enable the Blocksense sequencer and reporter node services.
            '');

            logsDir = mkOption {
              type = types.nullOr types.path;
              default = null;
              description = mdDoc "The directory to store the logs.";
            };

            package = mkOption {
              type = types.package;
              default = pkgs.erigon;
              description = mdDoc "Package to use as Sequencer node.";
            };

            sequencer = import ./sequencer-opts.nix lib;

            oracles = mkOption {
              type = types.attrsOf (mkSubmodule ./oracle-script-opts.nix);
              default = { };
              description = mdDoc "The set of oracle scripts to build.";
            };

            reporters = mkOption {
              type = types.attrsOf (mkSubmodule ./reporter-opts.nix);
              default = { };
              description = mdDoc "The set of reporter instances to run.";
            };

            anvil = mkOption {
              type = types.attrsOf (mkSubmodule ./anvil-opts.nix);
              default = { };
              description = mdDoc "The Anvil instance to use.";
            };

            config-files = mkOption {
              type = types.attrsOf (mkSubmodule ./config-files/submodule.nix);
              default = import ./config-files { inherit config self lib; };
            };

            config-dir = mkOption {
              type = types.package;
              readOnly = true;
              default =
                let
                  configs = lib.attrValues cfg.config-files;
                  paths = builtins.map (conf: conf.path) configs;
                in
                pkgs.linkFarmFromDrvs "blocksense-config-dir" paths;
            };
          };

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
