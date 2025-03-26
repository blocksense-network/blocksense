{
  self,
  config,
  ...
}:
let
  cfg = config.services.blocksense;
  inherit (self.lib) dashToUnderscore;
in
{
  mkReporterConfig =
    reporter-opts:
    dashToUnderscore {
      inherit (reporter-opts) reporter-info;

      capabilities = builtins.attrValues (
        builtins.mapAttrs (id: data: { inherit id data; }) reporter-opts.api-keys
      );

      # Shared config
      oracles = builtins.attrValues cfg.oracles;
      data_feeds = [ ];
    };
}
