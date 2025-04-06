{
  self,
  cfg,
  ...
}:
let
  inherit (self.lib) dashToUnderscoreRecursive dashToUnderscore;

  mkOracleScriptConfig =
    script-opts:
    dashToUnderscoreRecursive {
      inherit (script-opts)
        id
        name
        description
        exec-interval
        allowed-outbound-hosts
        ;

      oracle-script-wasm = "${script-opts.package}/lib/${dashToUnderscore script-opts.id}.wasm";
      interval-time-in-seconds = script-opts.exec-interval;
      capabilities = script-opts.api-keys;
    };

in
{
  mkReporterConfig =
    reporter-opts:
    dashToUnderscoreRecursive {
      reporter-info = {
        inherit (reporter-opts) second-consensus-secret-key kafka-endpoint;

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
      oracles = builtins.map mkOracleScriptConfig (builtins.attrValues cfg.oracles);
      data-feeds = [ ];
    };
}
