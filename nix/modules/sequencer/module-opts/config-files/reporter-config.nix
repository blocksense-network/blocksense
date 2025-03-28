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
      reporter-info = {
        inherit (reporter-opts) interval-time-in-seconds secret-key;
        reporter-id = reporter-opts.id;
        sequencer = reporter-opts.sequencer-url;
        registry = reporter-opts.registry-url;
      };

      capabilities = builtins.attrValues (
        builtins.mapAttrs (id: data: { inherit id data; }) reporter-opts.api-keys
      );

      # Shared config
      oracles = builtins.attrValues cfg.oracles;
      data-feeds = [ ];
    };
}
