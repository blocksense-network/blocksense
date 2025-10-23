{
  config,
  lib,
  ...
}:
let
  baseSequencer = config.services.blocksense.sequencer;
in
{
  imports = [
    ./example-setup-01.nix
  ];

  services.blocksense = {
    logsDir = lib.mkForce "$GIT_ROOT/logs/process-compose/example-setup-04";

    extra-sequencers.secondary = {
      inherit (baseSequencer)
        block-config
        providers
        whitelisted-reporters
        kafka-report-endpoint
        http-input-buffer-size
        log-level
        pyroscope-config
        ;
      id = 2;
      ports = {
        main = 9857;
        admin = 5554;
        metrics = 5552;
      };
    };

    reporters.a.sequencer-urls = [
      "http://127.0.0.1:9856"
      "http://127.0.0.1:9857"
    ];
  };
}
