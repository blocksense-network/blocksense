{ lib, blocksense, ... }:
with lib;
{
  options = {
    reporter-info = {
      sequencer = mkOption {
        type = types.str;
        default = "http://127.0.0.1:${toString blocksense.sequencer.main-port}";
        description = "The url of the sequencer.";
      };
      registry = mkOption {
        type = types.str;
        default = "http://127.0.0.1:${toString blocksense.sequencer.admin-port}";
        description = "The url of the registry.";
      };

      reporter_id = mkOption {
        type = types.int;
        description = mdDoc "The reporter id.";
        example = 1;
      };
      interval_time_in_seconds = mkOption {
        type = types.int;
        default = 10;
        description = "The period in seconds to poll for new data.";
      };
      secret_key = mkOption {
        type = types.str;
        description = "The path to the reporter secret key.";
      };
    };

    api-keys = {
      CMC_API_KEY = mkOption {
        type = types.str;
        description = "The path to the CMC api key.";
      };

      YAHOO_API_KEY = mkOption {
        type = types.str;
        description = "The path to the YF api key.";
      };
    };

    log-level = mkOption {
      type = types.enum [
        "trigger=debug"
        "trigger=info"
        "trigger=warn"
        "trigger=error"
        "trigger=trace"
      ];
      default = "trigger=trace";
      description = mdDoc "The log level for the reporter.";
    };
  };
}
