{ self, cfg, ... }:
let
  inherit (self.lib) dashToUnderscoreRecursive;
in
with cfg.sequencer;
dashToUnderscoreRecursive {
  inherit
    main-port
    admin-port
    block-config
    providers
    http-input-buffer-size
    ;

  sequencer-id = id;
  kafka-report-endpoint.url = kafka-report-endpoint;

  reporters = whitelisted-reporters;
  prometheus-port = metrics-port;
}
