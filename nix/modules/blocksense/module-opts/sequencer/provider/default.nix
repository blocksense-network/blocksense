lib: with lib; {
  options = {
    is-enabled = mkOption {
      type = types.bool;
      default = true;
      description = mdDoc "Is the provider enabled or not.";
    };

    private-key-path = mkOption {
      type = types.path;
      description = mdDoc "The path to the private key.";
    };

    url = mkOption {
      type = types.str;
      description = mdDoc "The URL of the provider.";
    };

    allow-feeds = mkOption {
      type = types.listOf types.int;
      default = [ ];
      description = mdDoc "List of allowed feed ids to be published";
    };

    publishing-criteria = mkOption {
      type = types.listOf (types.submodule (import ./publishing-criteria.nix lib));
      default = [ ];
      description = mdDoc "List of publishing criteria for feed per provider customizationo";
    };

    transaction-retries-count-limit = mkOption {
      type = types.int;
      default = 5;
      description = mdDoc "The retries count for transactions to be dropped.";
    };

    transaction-retry-timeout-secs = mkOption {
      type = types.int;
      default = 60;
      description = mdDoc "The timeout for transactions to be retried with higher fee.";
    };

    retry-fee-increment-fraction = mkOption {
      type = types.anything;
      default = 0.1;
      description = mdDoc "The increments to the gas price to apply when retry timeouts are reached.";
    };

    transaction-gas-limit = mkOption {
      type = types.int;
      default = 7500000;
      description = mdDoc "Transaction GAS limit for the provider.";
    };

    safe-min-quorum = mkOption {
      type = types.int;
      default = 1;
      description = mdDoc "Minimum number of reporters to sign the update before it can be posted.";
    };

    impersonated-anvil-account = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = mdDoc "The account to impersonate for the provider.";
    };

    contracts = mkOption {
      type = types.listOf (types.submodule (import ./contract.nix lib));
      default = [ ];
      description = mdDoc "List of contracts of various types";
    };
  };
}
