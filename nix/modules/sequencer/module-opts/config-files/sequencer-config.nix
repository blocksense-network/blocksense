{ self, cfg, ... }:
let
  inherit (self.lib) dashToUnderscoreRecursive;
in
with cfg.sequencer;
dashToUnderscoreRecursive {
  inherit
    sequencer-id
    main-port
    admin-port
    block-config
    providers
    kafka-report-endpoint
    http-input-buffer-size
    ;

  reporters = whitelisted-reporters;
  prometheus-port = metrics-port;
}
