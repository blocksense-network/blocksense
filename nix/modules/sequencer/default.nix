{
  lib,
  self,
  inputs,
  ...
}:
{
  flake.nixosModules =
    let
      inherit (self.lib) dashToUnderscore;

      mkReporters = keys: lib.imap0 (id: pub_key: { inherit id pub_key; }) keys;

      mkModule =
        backend:
        { config, ... }:
        let
          cfg = config.services.blocksense;

          configJSON =
            config: extraArgs:
            lib.pipe config [
              dashToUnderscore
              (params: params // extraArgs)
              builtins.toJSON
            ];

          sequencerConfigJSON = configJSON cfg.sequencer {
            reporters = mkReporters cfg.sequencer.reporters;
            prometheus_port = cfg.sequencer.metrics-port;
          };

          reportersConfigJSON = builtins.mapAttrs (
            n: v: (configJSON cfg.reporters.${n} { prometheus_url = cfg.reporters.${n}.metrics-url; })
          ) cfg.reporters;
        in
        with lib;
        {
          options.services.blocksense = {
            enable = mkEnableOption (mdDoc ''
              Enable the Blocksense sequencer and reporter node services.
            '');

            package = mkOption {
              type = types.package;
              default = pkgs.erigon;
              description = mdDoc "Package to use as Sequencer node.";
            };

            sequencer = import ./sequencer-opts.nix lib;

            reporters = mkOption {
              type = types.attrsOf (types.submodule (import ./reporter-opts.nix lib config));
              default = { };
              description = mdDoc "The set of reporter instances to run.";
            };

            anvil = mkOption {
              type = types.attrsOf (types.submoduleWith { modules = [ ./anvil-opts.nix ]; });
              default = { };
              description = mdDoc "The Anvil instance to use.";
            };

            _sequencer-config-txt = mkOption {
              type = types.str;
              description = "The materialized configuration for the sequencer.";
              default = sequencerConfigJSON;
            };

            _reporters-config-txt = mkOption {
              type = types.attrsOf types.str;
              description = "The materialized configuration for the reporters.";
              default = reportersConfigJSON;
            };
          };

          config.services.blocksense = {
            sequencer.providers = lib.mkIf (cfg.anvil != { }) (
              lib.mapAttrs (name: value: {
                "url" = lib.mkDefault "http://127.0.0.1:${toString value.port}";
              }) cfg.anvil
            );
          };

          imports = [ (import backend { inherit self inputs; }) ];
        };
    in
    {
      blocksense-systemd = mkModule ./backends/systemd.nix;
      blocksense-process-compose = mkModule ./backends/process-compose.nix;
    };
}
