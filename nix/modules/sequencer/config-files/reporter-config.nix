{
  self,
  cfg,
  ...
}:
let
  inherit (self.lib) dashToUnderscoreRecursive;
in
{
  mkReporterConfig =
    reporter-opts:
    dashToUnderscoreRecursive {
      inherit (reporter-opts) reporter-info;

      capabilities = builtins.attrValues (
        builtins.mapAttrs (id: data: { inherit id data; }) reporter-opts.api-keys
      );

      # Shared config
      oracles = builtins.attrValues cfg.oracles;
      data_feeds = [ ];
    };
}
