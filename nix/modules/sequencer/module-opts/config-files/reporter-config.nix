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
        inherit (reporter-opts) second-consensus-secret-key kafka-endpoint;

        reporter-id = reporter-opts.id;
        secret-key = reporter-opts.secret-key-path;
        sequencer = reporter-opts.sequencer-url;
        registry = reporter-opts.registry-url;
        interval-time-in-seconds = reporter-opts.default-exec-interval;
      };

      capabilities = builtins.attrValues (
        builtins.mapAttrs (id: data: { inherit id data; }) reporter-opts.api-keys
      );

      # Shared config
      oracles = builtins.attrValues cfg.oracles;
      data-feeds = [ ];
    };
}
