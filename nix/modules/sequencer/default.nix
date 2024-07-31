{
  lib,
  self,
  inputs,
  config,
  ...
}:
{
  flake.nixosModules =
    let
      inherit (self.lib) dashToUnderscore;
      mkFeeds =
        feeds:
        lib.pipe feeds [
          lib.attrsToList
          (lib.map ({ name, value }: { name = name; } // value))
          (lib.imap0 (id: config: { inherit id; } // config))
        ];

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
            feeds = mkFeeds cfg.sequencer.feeds;
            reporters = mkReporters cfg.sequencer.reporters;
            prometheus_port = cfg.sequencer.metrics-port;
          };

          reportersConfigJSON = builtins.mapAttrs (
            n: v:
            (configJSON cfg.reporters.${n} {
              feeds = mkFeeds cfg.reporters.${n}.feeds;
              prometheus_url = cfg.reporters.${n}.metrics-url;
            })
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
              type = types.attrsOf (
                types.submodule {
                  options = {
                    port = mkOption {
                      type = types.int;
                      default = 8545;
                      description = "The port to use for the Anvil instance.";
                    };
                  };
                }
              );
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
