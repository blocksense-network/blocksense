{ lib, blocksense, ... }:
with lib;
{
  options = {
    enable = mkEnableOption (mdDoc ''
      Enable reporter v1 service.
    '');

    full-batch = mkOption {
      type = types.bool;
      default = true;
      description = "";
    };

    batch-size = mkOption {
      type = types.int;
      default = 3;
      description = "The number of blocks to process in a single batch.";
    };

    sequencer-url = mkOption {
      type = types.str;
      default = "http://127.0.0.1:${toString blocksense.sequencer.main-port}";
      description = "The url of the sequencer.";
    };

    metrics-url = mkOption {
      type = types.str;
      default = "127.0.0.1:6666";
      description = mdDoc "The URL the reporter will listen on for prometheus metrics.";
    };

    poll-period-ms = mkOption {
      type = types.int;
      default = 300000;
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

      YH_FINANCE_API_KEY_PATH = mkOption {
        type = types.path;
        default = "/secret-keys/YH_FINANCE_API_KEY";
        description = "The path to the YF api key.";
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
  };
}
