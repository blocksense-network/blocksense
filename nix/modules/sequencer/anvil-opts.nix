{ lib, ... }:
with lib;
{
  options = {
    port = mkOption {
      type = types.int;
      default = 8544;
      description = "The port to use for the Anvil instance.";
    };
  };
}
