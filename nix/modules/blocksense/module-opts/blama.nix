{
  lib,
  self',
  config,
  ...
}:
let
  inherit (self'.packages) blama;
  inherit (lib) mkEnableOption mkOption types;
in
{
  options = {
    enable = mkEnableOption "Whether to enable the Blama server.";

    package = mkOption {
      type = types.package;
      default = blama;
    };

    host = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "The host to use for the Blama instance.";
    };

    port = mkOption {
      type = types.port;
      default = 7331;
      description = "The port to use for the Blama instance.";
    };

    modelPath = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "The GGUF model to use for the Blama instance.";
    };

    command = mkOption {
      type = types.str;
      readOnly = true;
      default = ''
        ${lib.getExe config.package}
      '';
    };

    environment = mkOption {
      type = types.attrsOf types.str;
      readOnly = true;
      default = {
        "BLAMA_PORT" = "${toString config.port}";
        "BLAMA_MODEL" = lib.mkIf (config.modelPath != null) config.modelPath;
      };
    };
  };
}
