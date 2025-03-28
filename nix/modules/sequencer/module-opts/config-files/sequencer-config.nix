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
    http-input-buffer-size
    ;

  kafka-report-endpoint.url = kafka-report-endpoint;

  reporters = whitelisted-reporters;
  prometheus-port = metrics-port;
}
