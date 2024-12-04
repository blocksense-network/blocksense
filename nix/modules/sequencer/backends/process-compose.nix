{ self', ... }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.blocksense;

  inherit (self'.apps) sequencer reporter blocksense;

  logsConfig = {
    fields_order = [
      "time"
      "level"
      "message"
    ];
    no_metadata = true;
    disable_json = true;
    add_timestamp = true;
    flush_each_line = true;
  };

  sequencerConfigJSON = pkgs.runCommandLocal "sequencer_config" { } ''
    mkdir -p $out
    echo '${cfg._sequencer-config-txt}' \
      | ${lib.getExe pkgs.jq} > $out/sequencer_config.json
  '';

  reportersConfigJSON = builtins.mapAttrs (
    name: _value:
    pkgs.runCommandLocal "reporter_config" { } ''
      mkdir -p $out/reporter-${name}
      echo '${cfg._reporters-config-txt.${name}}' \
        | ${lib.getExe pkgs.jq} > $out/reporter-${name}/reporter_config.json
    ''
  ) cfg.reporters;

  reportersV2ConfigJSON = builtins.mapAttrs (
    name: _value: pkgs.writers.writeJSON "blocksense-config.json" cfg._blocksense-config-txt.${name}
  ) cfg.reporters;

  anvilInstances = lib.mapAttrs' (
    name:
    { port, _command, ... }:
    {
      name = "anvil-${name}";
      value.process-compose = {
        command = _command;
        readiness_probe = {
          exec.command = ''
            curl -fsSL http://127.0.0.1:${toString port}/ \
              -H 'content-type: application/json' \
              --data-raw '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":0}'
          '';
          timeout_seconds = 30;
        };
        log_configuration = logsConfig;
        log_location = cfg.logsDir + "/anvil-${name}.log";
      };
    }
  ) cfg.anvil;

  anvilImpersonateAndFundInstances = lib.mapAttrs' (name: provider: {
    name = "anvil-impersonate-and-fund-${name}";
    value.process-compose = {
      command = "cast rpc --rpc-url ${toString provider.url} anvil_impersonateAccount ${toString provider.impersonated_anvil_account} && \
        cast send --rpc-url ${toString provider.url} ${toString provider.impersonated_anvil_account} --value 1000ether --from 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f --unlocked";
      shutdown.signal = 9;
      depends_on = {
        "anvil-${name}".condition = "process_healthy";
      };
    };
  }) cfg.sequencer.providers;

  reporterInstances = lib.mapAttrs' (name: conf: {
    name = "blocksense-reporter-${name}";
    value.process-compose = {
      command = "true";
      environment = [
        "FEEDS_CONFIG_DIR=${../../../../config}"
        "REPORTER_CONFIG_DIR=${reportersConfigJSON.${name}}/reporter-${name}"
        "RUST_LOG=${conf.log-level}"
      ];
      depends_on.blocksense-sequencer.condition = "process_started";
      shutdown.signal = 9;
      log_configuration = logsConfig;
      log_location = cfg.logsDir + "/reporter-${name}.log";
    };
  }) cfg.reporters;

  oracleScriptBuilder = lib.mapAttrs' (
    name:
    {
      path,
      source,
      build-command,
      ...
    }:
    {
      name = "oracle-script-builder-${name}";
      value.process-compose = {
        command = ''
          ${build-command} &&
          cp -v ${source} ${cfg.oracle-scripts.base-dir}
        '';
        working_dir = path;
      };
    }
  ) cfg.oracle-scripts.oracles;

  reporterV2Instances = lib.mapAttrs' (
    name:
    { log-level, ... }:
    {
      name = "reporter-v2-${name}";
      value.process-compose = {
        command = "${blocksense.program} node build --from ${reportersV2ConfigJSON.${name}} --up";
        environment = [ "RUST_LOG=${log-level}" ];
        depends_on =
          let
            oracle-scripts = lib.mapAttrs' (
              key: _value:
              lib.nameValuePair "oracle-script-builder-${key}" { condition = "process_completed_successfully"; }
            ) cfg.oracle-scripts.oracles;
          in
          oracle-scripts // { blocksense-sequencer.condition = "process_healthy"; };
        working_dir = cfg.oracle-scripts.base-dir;
      };
    }
  ) cfg.reporters-v2;

  sequencerInstance = {
    blocksense-sequencer.process-compose = {
      command = "${sequencer.program}";
      readiness_probe = {
        exec.command = ''
          curl -fsSL http://127.0.0.1:${toString cfg.sequencer.admin-port}/health \
            -H 'content-type: application/json'
        '';
        timeout_seconds = 30;
      };
      environment = [
        "FEEDS_CONFIG_DIR=${../../../../config}"
        "SEQUENCER_CONFIG_DIR=${sequencerConfigJSON}"
        "SEQUENCER_LOG_LEVEL=${lib.toUpper cfg.sequencer.log-level}"
      ];
      shutdown.signal = 9;
      depends_on = {
        "anvil-impersonate-and-fund-a".condition = "process_completed_successfully";
        "anvil-impersonate-and-fund-b".condition = "process_completed_successfully";
      };
      log_configuration = logsConfig;
      log_location = cfg.logsDir + "/sequencer.log";
    };
  };
in
{
  config = lib.mkIf cfg.enable {
    processes =
      anvilImpersonateAndFundInstances
      // oracleScriptBuilder
      // reporterV2Instances
      // sequencerInstance
      // anvilInstances
      // reporterInstances;
  };
}
