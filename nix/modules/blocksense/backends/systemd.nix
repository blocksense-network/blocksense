{ self', cfg, ... }:
{
  lib,
  pkgs,
  ...
}:
let
  inherit (self'.apps) sequencer blocksense;

  anvilInstances = lib.mapAttrs' (
    name:
    { command, ... }:
    {
      name = "blocksense-anvil-${name}";
      value = {
        description = "Blocksense Anvil ${name}";
        wantedBy = [ "multi-user.target" ];
        serviceConfig = {
          ExecStart = command;
          Restart = "always";
        };
      };
    }
  ) cfg.anvil;

  reporterInstances = lib.mapAttrs' (
    name:
    { log-level, ... }:
    let
      serviceName = "blocksense-reporter-${name}";
    in
    {
      name = serviceName;
      value = {
        description = "Reporter ${name}";
        wantedBy = [ "multi-user.target" ];
        requires = [ "blocksense-sequencer.service" ];
        environment = {
          RUST_LOG = "${log-level}";
        };
        path = [
          pkgs.coreutils
          self'.legacyPackages.spinWrapped
        ];
        serviceConfig = {
          StateDirectory = serviceName;
          WorkingDirectory = "/var/lib/${serviceName}";
          ExecStart = ''
            ${blocksense.program} node build --up \
              --from ${cfg.config-files."reporter_config_${name}".path}
          '';
          Restart = "always";
        };
      };
    }
  ) cfg.reporters;

  blamaInstance = {
    blocksense-blama = {
      description = "Blocksense Blama";
      # TODO: who needs this to be started?
      wantedBy = [ "multi-user.target" ];
      # TODO: what do we need to be started?
      # requires = [ "blocksense-sequencer.service" ];
      inherit (cfg.blama) environment;
      serviceConfig = {
        ExecStart = cfg.blama.command;
        Restart = "always";
      };
    };
  };
in
{
  config = lib.mkIf cfg.enable {
    systemd.services = lib.mkMerge [
      {
        blocksense-sequencer = {
          description = "Blocksense Sequencer";
          wantedBy = [ "multi-user.target" ];
          requires = lib.pipe cfg.anvil [
            builtins.attrNames
            (map (x: "blocksense-anvil-${x}.service"))
          ];
          environment = {
            FEEDS_CONFIG_DIR = "${../../../../apps/e2e-tests/src/process-compose/config}";
            SEQUENCER_CONFIG_DIR = cfg.config-dir;
            SEQUENCER_LOG_LEVEL = "${lib.toUpper cfg.sequencer.log-level}";
          };
          serviceConfig = {
            ExecStart = sequencer.program;
            Restart = "always";
            KillSignal = "SIGKILL";
          };
        };
      }
      (lib.mkIf cfg.kafka.enable {
        apache-kafka.enable = true;
      })
      anvilInstances
      reporterInstances
      (lib.mkIf cfg.blama.enable blamaInstance)
    ];
  };
}
