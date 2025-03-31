{ self, cfg, ... }:
let
  inherit (self.lib) dashToUnderscoreRecursive;
in
with cfg.sequencer;
dashToUnderscoreRecursive {
  inherit
    block-config
    providers
    http-input-buffer-size
    ;

  sequencer-id = id;

  prometheus-port = ports.metrics;
  admin-port = ports.admin;
  main-port = ports.main;

  kafka-report-endpoint.url = kafka-report-endpoint;

  reporters = whitelisted-reporters;
}
