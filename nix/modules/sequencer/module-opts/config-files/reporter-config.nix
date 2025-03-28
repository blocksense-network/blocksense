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
      inherit (reporter-opts.reporter-info) reporter-id interval-time-in-seconds secret-key;

      sequencer = reporter-opts.reporter-info.sequencer-url;
      registry = reporter-opts.reporter-info.registry-url;

      capabilities = builtins.attrValues (
        builtins.mapAttrs (id: data: { inherit id data; }) reporter-opts.api-keys
      );

      # Shared config
      oracles = builtins.attrValues cfg.oracles;
      data_feeds = [ ];
    };
}
