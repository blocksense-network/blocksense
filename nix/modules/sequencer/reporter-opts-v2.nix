{ lib, ... }:
with lib;
{
  options = {
    spin-config = mkOption {
      type = types.path;
      description = mdDoc "Path to the spin configuration.";
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
