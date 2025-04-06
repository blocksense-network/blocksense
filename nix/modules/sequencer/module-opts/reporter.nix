{ lib, cfg, ... }:
with lib;
{
  options = {
    sequencer-url = mkOption {
      type = types.str;
      default = "http://127.0.0.1:${toString cfg.sequencer.ports.main}";
      description = "The url of the sequencer.";
    };
    registry-url = mkOption {
      type = types.str;
      default = "http://127.0.0.1:${toString cfg.sequencer.ports.admin}";
      description = "The url of the registry.";
    };

    id = mkOption {
      type = types.int;
      description = mdDoc "The reporter id.";
      example = 1;
    };
    default-exec-interval = mkOption {
      type = types.int;
      default = 10;
      description = "Default component execution interval in seconds";
    };
    secret-key-path = mkOption {
      type = types.path;
      description = "The path to the reporter secret key.";
    };

    api-keys = mkOption {
      type = types.attrsOf types.str;
      default = { };
      example = {
        CMC_API_KEY = "/secrets/CMC_API_KEY";
        YAHOO_API_KEY = "/secrets/YH_FINANCE_API_KEY";
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
