lib:
# config:
# let
#   cfg = config.services.blocksense;
# in
with lib;
let
  providerOpts = {
    options = {
      is-enabled = mkOption {
        type = types.bool;
        default = true;
        description = mdDoc "Is the provider enabled or not.";
      };

      contract-version = mkOption {
        type = types.int;
        default = 1;
        description = mdDoc "The version of the ETH contract deployed on the network and associated with the parameter contract-address";
      };

      private-key-path = mkOption {
        type = types.path;
        description = mdDoc "The path to the private key.";
      };

      url = mkOption {
        type = types.str;
        # default = "http://127.0.0.1:${toString port}";
        description = mdDoc "The URL of the provider.";
      };

      allow-feeds = mkOption {
        type = types.listOf types.int;
        default = [ ];
        description = mdDoc "List of allowed feed ids to be published";
      };

      publishing-criteria = mkOption {
        type = types.listOf (types.submodule publishingCriteriaOpts);
        default = [ ];
        description = mdDoc "List of publishing criteria for feed per provider customizationo";
      };

      transaction-retries-count-before-give-up = mkOption {
        type = types.int;
        default = 5;
        description = mdDoc "The timeout for transactions to be dropped.";
      };

      transaction-retry-timeout-secs = mkOption {
        type = types.int;
        default = 50;
        description = mdDoc "The timeout for transactions to be retried with higher fee.";
      };

      retry-fee-increment-fraction = mkOption {
        type = types.anything;
        default = 0.1;
        description = mdDoc "The increments to the gas price to apply when retry timeouts are reached.";
      };

      transaction-gas-limit = mkOption {
        type = types.int;
        default = 7500000;
        description = mdDoc "Transaction GAS limit for the provider.";
      };

      contract-address = mkOption {
        type = types.str;
        description = mdDoc "The Historical Data Feed contract address.";
      };

      safe-address = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = mdDoc "Address of Gnosis Safe contract.";
      };

      safe-min-quorum = mkOption {
        type = types.int;
        default = 5;
        description = mdDoc "Minimum number of reporters to sign the update before it can be posted.";
      };

      impersonated-anvil-account = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = mdDoc "The account to impersonate for the provider.";
      };
    };
  };

  publishingCriteriaOpts = {
    options = {
      feed-id = mkOption {
        type = types.int;
        description = mdDoc "Feed id";
      };
      skip-publish-if-less-then-percentage = mkOption {
        type = types.float;
        default = 0.0;
        description = mdDoc "Publish updates only if they are greater then given threshould as percentage";
      };
      always-publish-heartbeat-ms = mkOption {
        type = types.int;
        default = 3600000;
        description = mdDoc "Interval to always publuish updates if there is not enough change";
      };
      peg-to-value = mkOption {
        type = types.nullOr types.float;
        default = null;
        description = mdDoc "This option is designed for stable coins. They get pegged to this value, if the reported value falls in a percentage window around the pegged value";
      };
      peg-tolerance-percentage = mkOption {
        type = types.float;
        default = 0.0;
        description = mdDoc "This option is designed for stable coins. Defines a tolerance window around the pegged value.";
      };
    };
  };

  blockConfigOpts = {
    options = {
      max-feed-updates-to-batch = mkOption {
        type = types.int;
        default = 1;
        description = mdDoc "The maximum number of keys to batch together before sending a report.";
      };

      block-generation-period = mkOption {
        type = types.int;
        default = 500;
        description = mdDoc "The maximum duration (in ms) to wait before sending aggregating the votes.";
      };

      genesis-block-timestamp = mkOption {
        type = types.nullOr (types.submodule systemTimeOpts);
        description = mdDoc "Time of genesis of blockchain.";
      };

      aggregation-consensus-discard-period-blocks = mkOption {
        type = types.int;
        default = 1000;
        description = mdDoc "Maximum number of blocks to consider for consensus. If there are blocks (batches) that are older and still await consensus, they will be dropped.";
      };
    };
  };

  systemTimeOpts = {
    options = {
      secs-since-epoch = mkOption {
        type = types.int;
        default = 0;
        description = mdDoc "Whole seconds since UNIX epoch.";
      };

      nanos-since-epoch = mkOption {
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

  reporterOpts = {
    options = {
      id = mkOption {
        type = types.int;
        description = mdDoc "Consecutive ids of the reporters.";
      };

      pub-key = mkOption {
        type = types.str;
        description = mdDoc "BLS public key of the reporter.";
      };

      address = mkOption {
        type = types.str;
        description = mdDoc "Gnosis Safe address of the reporter.";
      };
    };
  };
in
{
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
    default = { };
    description = mdDoc "The Ethereum JSON-RPC provider to use for sending tx.";
    example = {
      "ETH1" = {
        "private-key-path" = "/tmp/priv_key_test";
        "url" = "http://127.0.0.1:8545";
        "transaction-timeout-secs" = 420;
        "transaction-gas-limit" = 7500000;
        "contract-address" = "0x663F3ad617193148711d28f5334eE4Ed07016602";
      };
      "ETH2" = {
        "private-key-path" = "/tmp/priv_key_test";
        "url" = "http://127.0.0.1:8546";
        "transaction-timeout-secs" = 420;
        "transaction-gas-limit" = 7500000;
        "contract-address" = "0x663F3ad617193148711d28f5334eE4Ed07016602";
      };
    };
  };

  reporters = mkOption {
    type = types.listOf (types.submodule reporterOpts);
    default = [ ];
    description = mdDoc "The list of whitelisted reporter public keys.";
    example = [
      {
        id = 0;
        pub-key = "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e";
        address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      }
      {
        id = 1;
        pub-key = "ea30a8bd97d4f78213320c38215e95b239f8889df885552d85a50665b8b802de85fb40ae9b72d3f67628fa301e81252cd87e";
        address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      }
    ];
  };

  kafka-report-endpoint = mkOption {
    type = types.submodule kafkaReportEndpointOpts;
    default = { };
    description = mdDoc "URL to Apache Kafka server that facilitates decentralized communication.";
    example = {
      "url" = "127.0.0.1:9092";
    };
  };

  http-input-buffer-size = mkOption {
    type = types.nullOr types.int;
    default = null;
    description = mdDoc "The size of the buffer for incoming HTTP requests.";
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
