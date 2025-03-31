{
  cfg,
  lib,
  ...
}@args:
let
  inherit (import ./reporter-config.nix args) mkReporterConfig;

  reporter-configs = lib.mapAttrs' (
    name: opts: lib.nameValuePair "reporter_config_${name}" (mkReporterConfig opts)
  ) cfg.reporters;

  mkModuleSettings = builtins.mapAttrs (_: value: { settings = value; });
in
mkModuleSettings (
  reporter-configs
  // {
    "sequencer_config" = import ./sequencer-config.nix args;
  }
)
