{ self', ... }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.blocksense;

  reportersV2ConfigJSON = builtins.mapAttrs (
    name: _value: pkgs.writers.writeJSON "blocksense-config.json" cfg._blocksense-config-txt.${name}
  ) cfg.reporters-v2;

  inherit (self'.apps) sequencer reporter blocksense;

  anvilInstances = lib.mapAttrs' (
    name:
    { _command, ... }:
    {
      name = "blocksense-anvil-${name}";
      value = {
        description = "Blocksense Anvil ${name}";
        wantedBy = [ "multi-user.target" ];
        serviceConfig = {
          ExecStart = _command;
          Restart = "on-failure";
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
        FEEDS_CONFIG_DIR = "${../../../../config}";
        REPORTER_CONFIG_DIR = "/etc/blocksense/reporter-${name}";
        RUST_LOG = "${conf.log-level}";
      };
      serviceConfig = {
        ExecStart = reporter.program;
        Restart = "on-failure";
      };
    };
  }) cfg.reporters;

  reporterV2Instances = lib.mapAttrs' (
    name:
    { log-level, ... }:
    let
      serviceName = "blocksense-reporter-v2-${name}";
      wasmCopyCmd = lib.pipe self'.legacyPackages.oracle-scripts [
        builtins.attrValues
        (lib.concatMapStringsSep " " (p: "${p}/lib/*"))
        (files: "${lib.getExe pkgs.bash} -c 'set -x; cp ${files} %S/${serviceName}'")
      ];
    in
    {
      name = serviceName;
      value = {
        description = "Reporter v2 ${name}";
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
          ExecStartPre = wasmCopyCmd;
          ExecStart = "${blocksense.program} node build --from ${reportersV2ConfigJSON.${name}} --up";
          Restart = "on-failure";
        };
      };
    }
  ) cfg.reporters-v2;

  etcEnv = lib.mapAttrs' (name: _conf: {
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

    systemd.services =
      {
        blocksense-sequencer = {
          description = "Blocksense Sequencer";
          wantedBy = [ "multi-user.target" ];
          requires = lib.pipe cfg.anvil [
            builtins.attrNames
            (map (x: "blocksense-anvil-${x}.service"))
          ];
          environment = {
            FEEDS_CONFIG_DIR = "${../../../../config}";
            SEQUENCER_CONFIG_DIR = "/etc/blocksense";
            SEQUENCER_LOG_LEVEL = "${lib.toUpper cfg.sequencer.log-level}";
          };
          serviceConfig = {
            ExecStart = sequencer.program;
            Restart = "on-failure";
          };
        };
      }
      // anvilInstances
      // reporterInstances
      // reporterV2Instances;
  };
}
