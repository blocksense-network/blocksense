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
      inherit (self.lib) dashToUnderscore;

      mkModule =
        backend:
        { config, pkgs, ... }:
        let
          cfg = config.services.blocksense;

          inherit (withSystem pkgs.stdenv.hostPlatform.system (args: args)) inputs' self';
          inherit (config.services) blocksense;

          specialArgs = {
            inherit
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

          configJSON =
            config: extraArgs:
            lib.pipe config [
              dashToUnderscore
              (params: params // extraArgs)
              builtins.toJSON
            ];

          configJSON2 =
            config: extraArgs:
            lib.pipe config [
              dashToUnderscore
              (params: params // extraArgs)
            ];

          sequencerConfigJSON = configJSON cfg.sequencer {
            inherit (cfg.sequencer) reporters;
            prometheus_port = cfg.sequencer.metrics-port;
          };

          commonBlocksenseConfig = {
            oracles = builtins.attrValues cfg.oracles;
            data_feeds = [ ];
          };

          transformBlocksenseConfig =
            blocksense-cfg:
            (builtins.removeAttrs
              (configJSON2 blocksense-cfg {
                capabilities = builtins.attrValues (
                  builtins.mapAttrs (id: data: { inherit id data; }) blocksense-cfg.api-keys
                );
              })
              [
                "api_keys"
                "log_level"
              ]
            );

          blocksenseConfigJSON = lib.pipe cfg.reporters-v2 [
            (builtins.mapAttrs (
              _n: reporter-config: (transformBlocksenseConfig reporter-config) // commonBlocksenseConfig
            ))
          ];
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

            reporters-v2 = mkOption {
              type = types.attrsOf (mkSubmodule ./reporter-opts-v2.nix);
              default = { };
              description = mdDoc "The set of reporter instances to run.";
            };

            anvil = mkOption {
              type = types.attrsOf (mkSubmodule ./anvil-opts.nix);
              default = { };
              description = mdDoc "The Anvil instance to use.";
            };

            _sequencer-config-txt = mkOption {
              type = types.str;
              description = "The materialized configuration for the sequencer.";
              default = sequencerConfigJSON;
            };

            _blocksense-config-txt = mkOption {
              type = types.attrsOf types.raw;
              description = "The materialized configuration for the reporters v2.";
              default = blocksenseConfigJSON;
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
