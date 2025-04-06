{
  name,
  lib,
  self',
  config,
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

    package = mkOption {
      type = types.package;
      description = "Package of the wasm component to execute.";
      default = self'.legacyPackages.oracle-scripts.${config.id};
    };

    exec-interval = mkOption {
      type = types.int;
      description = "Component execution interval in seconds.";
    };

    allowed-outbound-hosts = mkOption {
      type = types.listOf types.str;
    };

    capabilities = mkOption {
      type = types.listOf types.str;
    };
  };
}
