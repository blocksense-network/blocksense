{ self, inputs }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.blocksense;

  inherit (self.apps.${pkgs.system}) sequencer reporter;
  inherit (inputs.ethereum-nix.packages.${pkgs.system}) foundry;

  sequencerConfigJSON = pkgs.runCommandLocal "sequencer_config" { } ''
    mkdir -p $out
    echo '${cfg._sequencer-config-txt}' \
      | ${lib.getExe pkgs.jq} > $out/sequencer_config.json
  '';

  reportersConfigJSON = builtins.mapAttrs (
    n: v:
    pkgs.runCommandLocal "reporter_config" { } ''
      mkdir -p $out/reporter-${n}
      echo '${cfg._reporters-config-txt.${n}}' \
        | ${lib.getExe pkgs.jq} > $out/reporter-${n}/reporter_config.json
    ''
  ) cfg.reporters;

  anvilInstances = lib.mapAttrs' (
    name:
    { port }:
    {
      name = "anvil-${name}";
      value.process-compose.command = "${foundry}/bin/anvil -p ${builtins.toString port}";
    }
  ) cfg.anvil;

  reporterInstances = lib.mapAttrs' (name: conf: {
    name = "blocksense-reporter-${name}";
    value.process-compose = {
      command = "${reporter.program}";
      environment = [
        "REPORTER_CONFIG_DIR=${reportersConfigJSON.${name}}/reporter-${name}"
        "RUST_LOG=${conf.log-level}"
      ];
      shutdown.signal = 9;
    };
  }) cfg.reporters;
in
{
  config = lib.mkIf cfg.enable {
    processes = {
      blocksense-sequencer.process-compose = {
        command = "${sequencer.program}";
        environment = [
          "SEQUENCER_CONFIG_DIR=${sequencerConfigJSON}"
          "SEQUENCER_LOGGING_LEVEL=${lib.toUpper cfg.sequencer.log-level}"
        ];
        shutdown.signal = 9;
      };
    } // anvilInstances // reporterInstances;
  };
}
