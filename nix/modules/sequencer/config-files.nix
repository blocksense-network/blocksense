{
  cfg,
  self,
  lib,
}:
let
  inherit (self.lib) dashToUnderscore getReporterConfigFilename;

  configJSON2 =
    config: extraArgs:
    lib.pipe config [
      dashToUnderscore
      (params: params // extraArgs)
    ];

  sequencerConfig = configJSON2 cfg.sequencer {
    inherit (cfg.sequencer) reporters;
    prometheus_port = cfg.sequencer.metrics-port;
  };

  commonBlocksenseConfig = {
    oracles = builtins.attrValues cfg.oracles;
    data_feeds = [ ];
  };

  transformBlocksenseConfig =
    blocksense-cfg:
    (builtins.removeAttrs
      (configJSON2 blocksense-cfg {
        capabilities = builtins.attrValues (
          builtins.mapAttrs (id: data: { inherit id data; }) blocksense-cfg.api-keys
        );
      })
      [
        "api_keys"
        "log_level"
      ]
    );

  reporterConfigs = lib.mapAttrs' (name: reporter-config: {
    name = getReporterConfigFilename name;
    value = (transformBlocksenseConfig reporter-config) // commonBlocksenseConfig;
  }) cfg.reporters;

  mkModuleSettings = builtins.mapAttrs (_: value: { settings = value; });

  configFiles = {
    sequencer_config = sequencerConfig;
  } // reporterConfigs;
in
mkModuleSettings configFiles
