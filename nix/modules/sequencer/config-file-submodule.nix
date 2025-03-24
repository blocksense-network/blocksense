{
  name,
  lib,
  pkgs,
  config,
  ...
}:
with lib;
{
  options = {
    settings = mkOption {
      type = types.attrs;
    };

    json = mkOption {
      type = types.str;
      readOnly = true;
      default = builtins.toJSON config.settings;
    };

    path = mkOption {
      type = types.path;
      readOnly = true;
      default = pkgs.writers.writeJSON "${name}.json" config.settings;
    };
  };
}
