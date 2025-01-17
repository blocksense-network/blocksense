lib:
# config:
# let
#   cfg = config.services.blocksense;
# in
with lib; let
  providerOpts = {
    options = {
      is_enabled = mkOption {
        type = types.bool;
        default = true;
        description = mdDoc "Is the provider enabled or not.";
      };

      private_key_path = mkOption {
        type = types.path;
        description = mdDoc "The path to the private key.";
      };

      url = mkOption {
        type = types.str;
        # default = "http://127.0.0.1:${toString port}";
        description = mdDoc "The URL of the provider.";
      };

      allow_feeds = mkOption {
        type = types.listOf types.int;
        default = [];
        description = mdDoc "List of allowed feed ids to be published";
      };

      publishing_criteria = mkOption {
        type = types.listOf (types.submodule publishingCriteriaOpts);
        default = [];
        description = mdDoc "List of publishing criteria for feed per provider customizationo";
      };

      transaction_drop_timeout_secs = mkOption {
        type = types.int;
        default = 420;
        description = mdDoc "The timeout for transactions to be dropped.";
      };

      transaction_retry_timeout_secs = mkOption {
        type = types.int;
        default = 50;
        description = mdDoc "The timeout for transactions to be retried with higher fee.";
      };

      retry_fee_increment_fraction = mkOption {
        type = types.anything;
        default = 0.1;
        description = mdDoc "The increments to the gas price to apply when retry timeouts are reached.";
      };

      transaction_gas_limit = mkOption {
        type = types.int;
        default = 7500000;
        description = mdDoc "Transaction GAS limit for the provider.";
      };

      contract_address = mkOption {
        type = types.str;
        description = mdDoc "The Historical Data Feed contract address.";
      };

      impersonated_anvil_account = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = mdDoc "The account to impersonate for the provider.";
      };
    };
  };

  publishingCriteriaOpts = {
    options = {
      feed_id = mkOption {
        type = types.int;
        description = mdDoc "Feed id";
      };
      skip_publish_if_less_then_percentage = mkOption {
        type = types.float;
        default = 0.0;
        description = mdDoc "Publish updates only if they are greater then given threshould as percentage";
      };
      always_publish_heartbeat_ms = mkOption {
        type = types.int;
        default = 3600000;
        description = mdDoc "Interval to always publuish updates if there is not enough change";
      };
    };
  };

  blockConfigOpts = {
    options = {
      max_feed_updates_to_batch = mkOption {
        type = types.int;
        default = 1;
        description = mdDoc "The maximum number of keys to batch together before sending a report.";
      };

      block_generation_period = mkOption {
        type = types.int;
        default = 500;
        description = mdDoc "The maximum duration (in ms) to wait before sending aggregating the votes.";
      };

      genesis_block_timestamp = mkOption {
        type = types.nullOr (types.submodule systemTimeOpts);
        description = mdDoc "Time of genesis of blockchain.";
      };
    };
  };

  systemTimeOpts = {
    options = {
      secs_since_epoch = mkOption {
        type = types.int;
        default = 0;
        description = mdDoc "Whole seconds since UNIX epoch.";
      };

      nanos_since_epoch = mkOption {
        type = types.int;
        default = 0;
        description = mdDoc "Nanosecond part of time since UNIX epoch.";
      };
    };
  };

  kafkaReportEndpointOpts = {
    options = {
      url = mkOption {
        type = types.nullOr types.str;
        description = mdDoc "The URL of the Apache Kafka server.";
      };
    };
  };
in {
  sequencer-id = mkOption {
    type = types.int;
    default = 1;
    description = mdDoc "An identifier for the sequencer, useful when we have more than one.";
  };

  main-port = mkOption {
    type = types.port;
    default = 8877;
    description = mdDoc "The port the sequencer will listen on for incoming reports.";
  };

  admin-port = mkOption {
    type = types.port;
    default = 5556;
    description = mdDoc "The port the sequencer will listen on for admin requests.";
  };

  metrics-port = mkOption {
    type = types.port;
    default = 5555;
    description = mdDoc "The port the sequencer will listen on for prometheus metrics.";
  };

  block-config = mkOption {
    type = types.submodule blockConfigOpts;
    description = mdDoc "Block creation configuration.";
  };

  providers = mkOption {
    type = types.attrsOf (types.submodule providerOpts);
    default = {};
    description = mdDoc "The Ethereum JSON-RPC provider to use for sending tx.";
    example = {
      "ETH1" = {
        "private_key_path" = "/tmp/priv_key_test";
        "url" = "http://127.0.0.1:8545";
        "transaction_timeout_secs" = 420;
        "transaction_gas_limit" = 7500000;
        "contract_address" = "0x663F3ad617193148711d28f5334eE4Ed07016602";
      };
      "ETH2" = {
        "private_key_path" = "/tmp/priv_key_test";
        "url" = "http://127.0.0.1:8546";
        "transaction_timeout_secs" = 420;
        "transaction_gas_limit" = 7500000;
        "contract_address" = "0x663F3ad617193148711d28f5334eE4Ed07016602";
      };
    };
  };

  reporters = mkOption {
    type = types.listOf types.str;
    default = [];
    description = mdDoc "The list of whitelisted reporter public keys.";
    example = [
      "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e"
      "ea30a8bd97d4f78213320c38215e95b239f8889df885552d85a50665b8b802de85fb40ae9b72d3f67628fa301e81252cd87e"
    ];
  };

  kafka-report-endpoint = mkOption {
    type = types.submodule kafkaReportEndpointOpts;
    default = {};
    description = mdDoc "URL to Apache Kafka server that facilitates decentralized communication.";
    example = {
      "url" = "localhost:9092";
    };
  };

  log-level = mkOption {
    type = types.enum [
      "debug"
      "info"
      "warn"
      "error"
    ];
    default = "debug";
    description = mdDoc "The log level for the sequencer.";
  };
}
