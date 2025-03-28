{ self, cfg, ... }:
let
  inherit (self.lib) dashToUnderscoreRecursive;
in
dashToUnderscoreRecursive {
  inherit (cfg.sequencer)
    sequencer-id
    main-port
    admin-port
    block-config
    providers
    http-input-buffer-size
    ;

  kafka-report-endpoint.url = cfg.sequencer.kafka-report-endpoint;

  reporters = cfg.sequencer.whitelisted-reporters;
  prometheus-port = cfg.sequencer.metrics-port;
}
