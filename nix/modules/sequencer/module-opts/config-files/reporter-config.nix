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
    let
      inherit (reporter-opts) reporter-info;
    in
    dashToUnderscoreRecursive {
      inherit (reporter-opts.reporter-info) interval-time-in-seconds secret-key;

      reporter-id = reporter-info.id;
      sequencer = reporter-info.sequencer-url;
      registry = reporter-info.registry-url;

      capabilities = builtins.attrValues (
        builtins.mapAttrs (id: data: { inherit id data; }) reporter-opts.api-keys
      );

      # Shared config
      oracles = builtins.attrValues cfg.oracles;
      data_feeds = [ ];
    };
}
