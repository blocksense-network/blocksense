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
        reporter-id = reporter-opts.id;
        sequencer = reporter-opts.sequencer-url;
        registry = reporter-opts.registry-url;
        interval-time-in-seconds = reporter-opts.default-exec-interval;
        secret-key = reporter-opts.secret-key-path;
      };

      capabilities = builtins.attrValues (
        builtins.mapAttrs (id: data: { inherit id data; }) reporter-opts.api-keys
      );

      # Shared config
      oracles = builtins.attrValues cfg.oracles;
      data-feeds = [ ];
    };
}
