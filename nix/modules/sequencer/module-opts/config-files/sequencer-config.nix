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
    reporters
    kafka-report-endpoint
    http-input-buffer-size
    ;

  prometheus-port = cfg.sequencer.metrics-port;
}
