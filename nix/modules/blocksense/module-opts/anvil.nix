{
  lib,
  self',
  config,
  ...
}:
with lib;
let
  inherit (self'.legacyPackages) foundry;
in
{
  options = {
    package = mkOption {
      type = types.package;
      default = foundry;
    };

    port = mkOption {
      type = types.int;
      default = 8544;
      description = "The port to use for the Anvil instance.";
    };

    chain-id = mkOption {
      type = types.nullOr types.int;
      default = null;
      description = "The chain ID to use for the Anvil instance.";
    };

    fork-url = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "The fork URL to use for the Anvil instance.";
    };

    auto-impersonate = mkOption {
      type = types.bool;
      default = true;
      description = "Enables automatic impersonation on startup. This allows any transaction sender to be simulated as different accounts, which is useful for testing contract behavior";
    };

    fork-block-number = mkOption {
      type = types.nullOr types.int;
      default = null;
      description = "The block number to fork from when using fork-url.";
    };

    fork-chain-id = mkOption {
      type = types.nullOr types.int;
      default = null;
      description = "The chain ID of the forked network (enables offline start).";
    };

    state = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "The state file to load from or save to.";
    };

    command = mkOption {
      type = types.str;
      readOnly = true;
      default =
        ''
          ${config.package}/bin/anvil \
            --port ${toString config.port} \
            --prune-history \
        ''
        + lib.optionalString (config.auto-impersonate) ''
          --auto-impersonate \
        ''
        + lib.optionalString (config.chain-id != null) ''
          --chain-id ${toString config.chain-id} \
        ''
        + lib.optionalString (config.fork-url != null) ''
          --fork-url ${config.fork-url} \
        ''
        + lib.optionalString (config.fork-block-number != null) ''
          --fork-block-number ${toString config.fork-block-number} \
        ''
        + lib.optionalString (config.fork-chain-id != null) ''
          --fork-chain-id ${toString config.fork-chain-id} \
        ''
        + lib.optionalString (config.state != null) ''
          --state ${config.state}
        '';
    };
  };
}
