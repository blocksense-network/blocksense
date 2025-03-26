{
  config,
  lib,
  self,
  ...
}@args:
let
  cfg = config.services.blocksense;
  inherit (self.lib) getReporterConfigFilename;
  inherit (import ./reporter-config.nix args) mkReporterConfig;

  reporter-configs = lib.mapAttrs' (
    name: opts: lib.nameValuePair (getReporterConfigFilename name) (mkReporterConfig opts)
  ) cfg.reporters;

  mkModuleSettings = builtins.mapAttrs (_: value: { settings = value; });
in
mkModuleSettings (
  reporter-configs
  // {
    sequencer_config = import ./sequencer-config.nix args;
  }
)
