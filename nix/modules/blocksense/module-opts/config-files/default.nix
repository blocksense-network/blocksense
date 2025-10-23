{
  cfg,
  lib,
  ...
}@args:
let
  inherit (import ./reporter-config.nix args) mkReporterConfig;
  mkSequencerConfig = import ./sequencer-config.nix args;

  reporter-configs = lib.mapAttrs' (
    name: opts: lib.nameValuePair "reporter_config_${name}" (mkReporterConfig opts)
  ) cfg.reporters;

  sequencer-configs = {
    sequencer_config = mkSequencerConfig cfg.sequencer;
  }
  // lib.mapAttrs' (
    name: sequencer: lib.nameValuePair "sequencer_config_${name}" (mkSequencerConfig sequencer)
  ) cfg.extra-sequencers;

  mkModuleSettings = builtins.mapAttrs (_: value: { settings = value; });
in
mkModuleSettings (reporter-configs // sequencer-configs)
