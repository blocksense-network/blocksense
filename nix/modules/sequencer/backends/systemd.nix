{ self, inputs }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.blocksense;
  inherit (pkgs) system;
  inherit (self.apps.${system}) sequencer reporter;
  inherit (self.legacyPackages.${system}) foundry;

  anvilInstances = lib.mapAttrs' (
    name:
    { port }:
    {
      name = "blocksense-anvil-${name}";
      value = {
        description = "Anvil ${name}";
        wantedBy = [ "multi-user.target" ];
        serviceConfig = {
          ExecStart = "${foundry}/bin/anvil -p ${builtins.toString port}";
        };
      };
    }
  ) cfg.anvil;

  reporterInstances = lib.mapAttrs' (name: conf: {
    name = "blocksense-reporter-${name}";
    value = {
      description = "Reporter ${name}";
      wantedBy = [ "multi-user.target" ];
      requires = [ "blocksense-sequencer.service" ];
      environment = {
        FEEDS_CONFIG_DIR = "${../../../../libs/feed_registry}";
        REPORTER_CONFIG_DIR = "/etc/blocksense/reporter-${name}";
        RUST_LOG = "${conf.log-level}";
      };
      serviceConfig = {
        ExecStart = reporter.program;
      };
    };
  }) cfg.reporters;

  etcEnv = lib.mapAttrs' (name: conf: {
    name = "blocksense/reporter-${name}/reporter_config.json";
    value.text = cfg._reporters-config-txt.${name};
  }) cfg.reporters;
in
{
  config = lib.mkIf cfg.enable {
    environment.etc = {
      "blocksense/sequencer_config.json" = {
        text = cfg._sequencer-config-txt;
      };
    } // etcEnv;

    systemd.services = {
      blocksense-sequencer = {
        description = "Blocksense Sequencer";
        wantedBy = [ "multi-user.target" ];
        requires = lib.pipe cfg.anvil [
          builtins.attrNames
          (map (x: "blocksense-anvil-${x}.service"))
        ];
        environment = {
          FEEDS_CONFIG_DIR = "${../../../../libs/feed_registry}";
          SEQUENCER_CONFIG_DIR = "/etc/blocksense";
          SEQUENCER_LOGGING_LEVEL = "${lib.toUpper cfg.sequencer.log-level}";
        };
        serviceConfig = {
          ExecStart = sequencer.program;
        };
      };
    } // anvilInstances // reporterInstances;
  };
}
