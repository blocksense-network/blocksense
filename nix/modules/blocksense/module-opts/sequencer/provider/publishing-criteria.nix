lib: with lib; {
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
}
