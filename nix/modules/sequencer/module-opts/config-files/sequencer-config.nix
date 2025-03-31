{ self, cfg, ... }:
let
  inherit (self.lib) dashToUnderscoreRecursive;
in
dashToUnderscoreRecursive {
  inherit (cfg.sequencer)
    main-port
    admin-port
    block-config
    providers
    http-input-buffer-size
    ;

  sequencer-id = cfg.sequencer.id;
  kafka-report-endpoint.url = cfg.sequencer.kafka-report-endpoint;

  reporters = cfg.sequencer.whitelisted-reporters;
  prometheus-port = cfg.sequencer.metrics-port;
}
