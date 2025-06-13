{ lib, cfg, ... }:
with lib;
{
  options = {
    id = mkOption {
      type = types.int;
      description = mdDoc "The reporter id.";
      example = 1;
    };

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

    metrics-url = mkOption {
      type = types.str;
      default = "http://0.0.0.0:9091/metrics/job/reporter";
      description = "The url of the metrics service.";
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

    second-consensus-secret-key-path = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = "The path to the reporter second consensus secret key.";
    };

    kafka-endpoint = mkOption {
      type = types.nullOr types.str;
      default = cfg.sequencer.kafka-report-endpoint;
      description = "The url of the kafka server.";
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
        "trigger=trace,feeds_processing=info"
        "trigger=debug"
        "trigger=info"
        "trigger=warn"
        "trigger=error"
        "trigger=trace"
      ];
      default = "trigger=trace,feeds_processing=info";
      description = mdDoc "The log level for the reporter.";
    };
  };
}
