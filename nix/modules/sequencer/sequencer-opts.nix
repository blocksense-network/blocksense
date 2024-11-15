lib:
# config:
# let
#   cfg = config.services.blocksense;
# in
with lib;
let
  providerOpts =
    # {config, ...}: let
    #   providerName = config._module.args.name;
    #   inherit (cfg.anvil."${providerName}") port;
    # in
    {
      options = {
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
          default = [ ];
          description = mdDoc "List of allowed feed ids to be published";
        };

        transcation_timeout_secs = mkOption {
          type = types.int;
          default = 50;
          description = mdDoc "The timeout for transactions.";
        };

        contract_address = mkOption {
          type = types.str;
          description = mdDoc "The Historical Data Feed contract address.";
        };
      };
    };
in
{
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

  max-keys-to-batch = mkOption {
    type = types.int;
    default = 1;
    description = mdDoc "The maximum number of keys to batch together before sending a report.";
  };

  keys-batch-duration = mkOption {
    type = types.int;
    default = 500;
    description = mdDoc "The maximum duration (in ms) to wait before sending aggregating the votes.";
  };

  providers = mkOption {
    type = types.attrsOf (types.submodule providerOpts);
    default = { };
    description = mdDoc "The Ethereum JSON-RPC provider to use for sending tx.";
    example = {
      "ETH1" = {
        "private_key_path" = "/tmp/priv_key_test";
        "url" = "http://127.0.0.1:8545";
        "transcation_timeout_secs" = 50;
        "contract_address" = "0x663F3ad617193148711d28f5334eE4Ed07016602";
      };
      "ETH2" = {
        "private_key_path" = "/tmp/priv_key_test";
        "url" = "http://127.0.0.1:8546";
        "transcation_timeout_secs" = 50;
        "contract_address" = "0x663F3ad617193148711d28f5334eE4Ed07016602";
      };
    };
  };

  reporters = mkOption {
    type = types.listOf types.str;
    default = [ ];
    description = mdDoc "The list of whitelisted reporter public keys.";
    example = [
      "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e"
      "ea30a8bd97d4f78213320c38215e95b239f8889df885552d85a50665b8b802de85fb40ae9b72d3f67628fa301e81252cd87e"
    ];
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
