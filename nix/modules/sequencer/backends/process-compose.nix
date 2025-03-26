{ self', self, ... }:
{
  config,
  lib,
  ...
}:
let
  cfg = config.services.blocksense;

  inherit (self'.apps)
    sequencer
    blocksense
    blockchain_reader
    aggregate_consensus_reader
    ;

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
      _command,
      ...
    }:
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

  installOracleScripts =
    dir:
    lib.pipe self'.legacyPackages.oracle-scripts [
      builtins.attrValues
      (lib.concatMapStringsSep " " (p: "${p}/lib/*"))
      (files: "cp -vf ${files} ${dir}")
    ];

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
          command =
            let
              reporter-config = cfg.config-files.${self.lib.getReporterConfigFilename name};
            in
            ''
              mkdir -p "${working_dir}" &&
              cd "${working_dir}" &&
              ${installOracleScripts working_dir} &&
              ${blocksense.program} node build --from ${reporter-config.path} --up
            '';
          environment = [ "RUST_LOG=${log-level}" ];
          depends_on = {
            blocksense-sequencer.condition = "process_healthy";
          };
          log_configuration = logsConfig;
          log_location = cfg.logsDir + "/reporter-${name}.log";
        };
    }
  ) cfg.reporters;

  sequencerInstance = {
    blocksense-sequencer.process-compose = {
      command = "${sequencer.program}";
      readiness_probe = {
        exec.command = ''
          curl -fsSL http://127.0.0.1:${toString cfg.sequencer.admin-port}/health \
            -H 'content-type: application/json'
        '';
        initial_delay_seconds = 0;
        period_seconds = 1;
        timeout_seconds = 30;
      };
      environment = [
        "FEEDS_CONFIG_DIR=${../../../../config}"
        "SEQUENCER_CONFIG_DIR=${cfg.config-dir}"
        "SEQUENCER_LOG_LEVEL=${lib.toUpper cfg.sequencer.log-level}"
      ];
      shutdown.signal = 9;
      depends_on = {
        "anvil-impersonate-and-fund-ethereum-sepolia".condition = "process_completed_successfully";
        "anvil-impersonate-and-fund-ink-sepolia".condition = "process_completed_successfully";
      };
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
in
{
  config = lib.mkIf cfg.enable {
    processes =
      anvilImpersonateAndFundInstances
      // reporterInstances
      // sequencerInstance
      // anvilInstances
      // blockchainReader
      // aggregateConsensusReader;
  };
}
