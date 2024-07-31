lib: config:
with lib;
let
  feedOpts = {
    options = {
      report_interval_ms = mkOption {
        default = 60000;
        type = types.int;
        description = mdDoc "The interval in ms to report on.";
      };

      first_report_start_time = {
        secs_since_epoch = mkOption {
          type = types.int;
          default = 0;
          description = mdDoc "The start of the data feed";
        };

        nanos_since_epoch = mkOption {
          type = types.int;
          default = 0;
          description = mdDoc "The nanoseconds since epoch";
        };
      };
    };
  };
in
{
  options = {
    batch-size = mkOption {
      type = types.int;
      default = 3;
      description = "The number of blocks to process in a single batch.";
    };

    sequencer-url = mkOption {
      type = types.str;
      default = "http://127.0.0.1:${toString config.services.blocksense.sequencer.main-port}";
      description = "The url of the sequencer.";
    };

    log-level = mkOption {
      type = types.enum [
        "debug"
        "info"
        "warn"
        "error"
      ];
      default = "debug";
      description = mdDoc "The log level for the reporter.";
    };

    metrics-url = mkOption {
      type = types.str;
      default = "127.0.0.1:6666";
      description = mdDoc "The URL the reporter will listen on for prometheus metrics.";
    };

    poll-period-ms = mkOption {
      type = types.int;
      default = 5000;
      description = "The period in ms to poll for new blocks.";
    };

    resources = {
      SECRET_KEY_PATH = mkOption {
        type = types.path;
        default = "/secret-keys/reporter_secret_key";
        description = "The path to the reporter secret key.";
      };

      CMC_API_KEY_PATH = mkOption {
        type = types.path;
        default = "/secret-keys/CMC_API_KEY";
        description = "The path to the CMC api key.";
      };
    };

    reporter = {
      id = mkOption {
        type = types.int;
        default = 0;
        description = mdDoc "The reporter id.";
        example = 1;
      };

      pub_key = mkOption {
        type = types.str;
        default = "";
        description = mdDoc "The reporter public key.";
        example = "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e";
      };
    };

    feeds = mkOption {
      type = types.attrsOf (types.submodule feedOpts);
      default = { };
      description = mdDoc "The list of feeds to report on.";
      example = {
        "BTC/USD" = {
          "report_interval_ms" = 30000;
          "first_report_start_time" = {
            "secs_since_epoch" = 1721077200;
            "nanos_since_epoch" = 1721077200;
          };
        };
        "ETH/USD" = {
          "report_interval_ms" = 60000;
          "first_report_start_time" = {
            "secs_since_epoch" = 1720818000;
            "nanos_since_epoch" = 1720818000;
          };
        };
      };
    };
  };
}
