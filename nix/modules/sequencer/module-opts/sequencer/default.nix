lib: with lib; {
  id = mkOption {
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
    type = types.submodule (import ./block-config lib);
    description = mdDoc "Block creation configuration.";
  };

  providers = mkOption {
    type = types.attrsOf (types.submodule (import ./provider lib));
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

  whitelisted-reporters = mkOption {
    type = types.listOf (types.submodule (import ./whitelisted-reporters.nix lib));
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
    type = types.nullOr types.str;
    description = mdDoc "URL to Apache Kafka server that facilitates decentralized communication.";
    example = "127.0.0.1:9092";
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
