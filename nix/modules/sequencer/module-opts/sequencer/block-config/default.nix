lib: with lib; {
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
      type = types.nullOr (types.submodule (import ./system-time.nix lib));
      description = mdDoc "Time of genesis of blockchain.";
    };

    aggregation-consensus-discard-period-blocks = mkOption {
      type = types.int;
      default = 1000;
      description = mdDoc "Maximum number of blocks to consider for consensus. If there are blocks (batches) that are older and still await consensus, they will be dropped.";
    };
  };
}
