{ self', ... }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.blocksense;

  reportersConfigJSON = builtins.mapAttrs (
    name: _value: pkgs.writers.writeJSON "blocksense-config.json" cfg._blocksense-config-txt.${name}
  ) cfg.reporters;

  inherit (self'.apps) sequencer blocksense;

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

  reporterInstances = lib.mapAttrs' (
    name:
    { log-level, ... }:
    let
      serviceName = "blocksense-reporter-${name}";
      wasmCopyCmd = lib.pipe self'.legacyPackages.oracle-scripts [
        builtins.attrValues
        (lib.concatMapStringsSep " " (p: "${p}/lib/*"))
        (files: "${lib.getExe pkgs.bash} -c 'set -x; cp ${files} %S/${serviceName}'")
      ];
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
          ExecStartPre = wasmCopyCmd;
          ExecStart = "${blocksense.program} node build --from ${reportersConfigJSON.${name}} --up";
          Restart = "on-failure";
        };
      };
    }
  ) cfg.reporters;
in
{
  config = lib.mkIf cfg.enable {
    environment.etc = {
      "blocksense/sequencer_config.json" = {
        text = cfg._sequencer-config-txt;
      };
    };

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
      // reporterInstances;
  };
}
