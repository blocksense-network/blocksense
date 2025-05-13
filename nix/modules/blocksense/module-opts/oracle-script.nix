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
      type = types.oneOf [
        types.package
        types.str
      ];
      description = ''
        Package of the wasm component to execute.
        Optionally it could be a string path leading to the location of the wasm file.
      '';
      default = self'.legacyPackages.oracle-scripts.${config.id};
    };

    exec-interval = mkOption {
      type = types.int;
      description = "Component execution interval in seconds.";
    };

    allowed-outbound-hosts = mkOption {
      type = types.listOf types.str;
    };

    api-keys = mkOption {
      type = types.listOf types.str;
      description = "A set of api keys the oracle script requires.";
      default = [ ];
    };
  };
}
