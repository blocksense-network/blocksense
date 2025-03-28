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
    kafka-report-endpoint
    http-input-buffer-size
    ;

  reporters = cfg.sequencer.whitelisted-reporters;
  prometheus-port = cfg.sequencer.metrics-port;
}
