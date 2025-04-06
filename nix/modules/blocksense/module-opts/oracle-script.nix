{
  lib,
  self',
  name,
  ...
}:
with lib;
{
  options = {
    id = mkOption {
      type =
        let
          availableScripts = builtins.attrNames self'.legacyPackages.oracle-scripts;
        in
        types.enum availableScripts;
      default = name;
    };

    name = mkOption {
      type = types.nullOr types.str;
      default = null;
    };

    description = mkOption {
      type = types.nullOr types.str;
      default = null;
    };

    oracle-script-wasm = mkOption {
      type = types.str;
    };

    exec-interval = mkOption {
      type = types.int;
      description = "Component execution interval in seconds";
    };

    allowed-outbound-hosts = mkOption {
      type = types.listOf types.str;
    };

    capabilities = mkOption {
      type = types.listOf types.str;
    };
  };
}
