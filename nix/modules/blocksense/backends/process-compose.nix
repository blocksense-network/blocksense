{
  self',
  cfg,
  ...
}:
{
  config,
  lib,
  ...
}:
let
  inherit (self'.apps)
    blockchain_reader
    aggregate_consensus_reader
    ;
  inherit (self'.packages)
    blama
    ;

  # process-compose will replace `$GIT_ROOT` on startup
  mkCargoTargetExePath = executable-name: "$GIT_ROOT/target/release/${executable-name}";

  logsConfig = {
    fields_order = [
      "message"
    ];
    no_metadata = true;
    no_color = true;
    disable_json = true;
    flush_each_line = true;
  };

  anvilInstances = lib.mapAttrs' (
    name:
    {
      port,
      command,
      ...
    }:
    {
      name = "anvil-${name}";
      value.process-compose = {
        inherit command;
        readiness_probe = {
          exec.command = ''
            curl -fsSL http://127.0.0.1:${toString port}/ \
              -H 'content-type: application/json' \
              --data-raw '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":0}'
          '';
          initial_delay_seconds = 0;
          period_seconds = 1;
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
      command = "cast rpc --rpc-url ${toString provider.url} anvil_impersonateAccount ${toString provider.impersonated-anvil-account} && \
        cast send --rpc-url ${toString provider.url} ${toString provider.impersonated-anvil-account} --value 1000ether --from 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f --unlocked";
      shutdown.signal = 9;
      depends_on = {
        "anvil-${name}".condition = "process_healthy";
      };
    };
  }) cfg.sequencer.providers;

  reporterInstances = lib.mapAttrs' (
    name:
    { log-level, ... }:
    {
      name = "blocksense-reporter-${name}";
      value.process-compose =
        let
          working_dir = toString (/. + config.devenv.state + /blocksense/reporter/${name});
        in
        {
          command = ''
            mkdir -p "${working_dir}" &&
            cd "${working_dir}" &&
            rm -rf ./test-keys &&
            cp -r "$GIT_ROOT/nix/test-environments/test-keys" ./test-keys &&
            ${mkCargoTargetExePath "blocksense"} node build --up \
              --from ${cfg.config-files."reporter_config_${name}".path}
          '';
          environment = [
            "RUST_LOG=${log-level}"
            "SPIN_DATA_DIR=$GIT_ROOT/target/spin-artifacts"
            "LD_LIBRARY_PATH=${lib.makeLibraryPath self'.legacyPackages.commonLibDeps}"
          ];
          depends_on = {
            blocksense-sequencer.condition = "process_healthy";
          };
          log_configuration = logsConfig;
          log_location = cfg.logsDir + "/reporter-${name}.log";
          shutdown.signal = 9;
        };
    }
  ) cfg.reporters;

  sequencerInstance = {
    blocksense-sequencer.process-compose = {
      command = ''
        if [ -z "$FEEDS_CONFIG_DIR" ]; then
          FEEDS_CONFIG_DIR=${../../../../config}
        fi
        ${mkCargoTargetExePath "sequencer"}
      '';

      readiness_probe = {
        exec.command = ''
          curl -fsSL http://127.0.0.1:${toString cfg.sequencer.ports.admin}/health \
            -H 'content-type: application/json'
        '';
        initial_delay_seconds = 0;
        period_seconds = 10;
        timeout_seconds = 30;
        success_threshold = 1;
        failure_threshold = 10;
      };
      environment = [
        "SEQUENCER_CONFIG_DIR=${cfg.config-dir}"
        "SEQUENCER_LOG_LEVEL=${lib.toUpper cfg.sequencer.log-level}"
        "LD_LIBRARY_PATH=${lib.makeLibraryPath self'.legacyPackages.commonLibDeps}"
      ];
      shutdown.signal = 9;
      depends_on = lib.mapAttrs' (name: value: {
        name = "anvil-impersonate-and-fund-${name}";
        value = {
          condition = "process_completed_successfully";
        };
      }) cfg.sequencer.providers;
      log_configuration = logsConfig;
      log_location = cfg.logsDir + "/sequencer.log";
    };
  };

  blockchainReader = {
    blockchain-reader.process-compose = {
      command = "${blockchain_reader.program} --bootstrap-server localhost:9092 --topic blockchain --from-beginning";
      shutdown.signal = 9;
      depends_on.kafka.condition = "process_started";
      log_configuration = logsConfig;
      log_location = cfg.logsDir + "/blockchain-reader.log";
    };
  };

  aggregateConsensusReader = {
    aggregate-consensus-reader.process-compose = {
      command = "${aggregate_consensus_reader.program}  --bootstrap-server localhost:9092 --topic aggregation_consensus --from-beginning";
      shutdown.signal = 9;
      depends_on.kafka.condition = "process_started";
      log_configuration = logsConfig;
      log_location = cfg.logsDir + "/aggregate-consensus-reader.log";
    };
  };

  blamaInstance = {
    blama.process-compose = {
      inherit (cfg.blama) command;
      environment = lib.mapAttrsToList (k: v: "${k}=${v}") cfg.blama.environment;
      shutdown.signal = 9;
      log_configuration = logsConfig;
      log_location = cfg.logsDir + "/blama.log";
      # TODO: Adequate `readiness_probe`
      # readiness_probe = {};
    };
  };
in
{
  config = lib.mkIf cfg.enable {
    processes = lib.mkMerge [
      anvilImpersonateAndFundInstances
      reporterInstances
      sequencerInstance
      anvilInstances
      (lib.mkIf config.services.kafka.enable blockchainReader)
      (lib.mkIf config.services.kafka.enable aggregateConsensusReader)
      (lib.mkIf cfg.blama.enable blamaInstance)
    ];
  };
}
