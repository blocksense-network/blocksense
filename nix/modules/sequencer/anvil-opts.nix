{ lib, ... }:
with lib;
{
  options = {
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
  };
}
