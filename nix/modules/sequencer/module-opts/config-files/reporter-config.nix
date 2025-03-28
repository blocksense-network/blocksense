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
    with reporter-opts;
    dashToUnderscoreRecursive {
      reporter-info = {
        inherit interval-time-in-seconds secret-key;
        reporter-id = id;
        sequencer = sequencer-url;
        registry = registry-url;
      };

      capabilities = builtins.attrValues (builtins.mapAttrs (id: data: { inherit id data; }) api-keys);

      # Shared config
      oracles = builtins.attrValues cfg.oracles;
      data-feeds = [ ];
    };
}
