{
  config,
  lib,
  ...
}:
let
  cfg = config.services.blocksense;
  inherit (lib) mkIf mkMerge;

  all-sequencers = [ cfg.sequencer ] ++ builtins.attrValues cfg.extra-sequencers;
  any-sequencer-has-kafka = lib.any (
    sequencer: sequencer.kafka-report-endpoint != null
  ) all-sequencers;

  reporter-assetions = name: reporter-cfg: [
    {
      assertion = any-sequencer-has-kafka -> (reporter-cfg.second-consensus-secret-key-path != null);
      message = ''
        Reporter "${name}" has invalid config.
          Caused by: Second phase consensus requires kafka-endpoint and secp256k1 key present.
      '';
    }
  ];

  collected-reporter-assertions = mkIf (cfg.reporters != null) (
    lib.flatten (lib.mapAttrsToList reporter-assetions cfg.reporters)
  );
in
{
  config = mkIf cfg.enable {
    assertions = mkMerge [
      collected-reporter-assertions
    ];
  };
}
