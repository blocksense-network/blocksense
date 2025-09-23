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
      type = types.int;
      default = 99999999999;
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

    command = mkOption {
      type = types.str;
      readOnly = true;
      default = ''
        ${config.package}/bin/anvil \
          --port ${toString config.port} \
          --chain-id ${toString config.chain-id} \
          --prune-history \
      ''
      + lib.optionalString config.auto-impersonate ''
        --auto-impersonate \
      ''
      + lib.optionalString (config.fork-url != null) ''
        --fork-url ${config.fork-url}
      '';
    };
  };
}
