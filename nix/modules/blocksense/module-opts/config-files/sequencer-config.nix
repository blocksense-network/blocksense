{ self, ... }:
sequencer:
let
  inherit (self.lib) dashToUnderscoreRecursive;
in
dashToUnderscoreRecursive {
  inherit (sequencer)
    block-config
    providers
    http-input-buffer-size
    pyroscope-config
    ;

  sequencer-id = sequencer.id;

  prometheus-port = sequencer.ports.metrics;
  admin-port = sequencer.ports.admin;
  main-port = sequencer.ports.main;

  kafka-report-endpoint.url = sequencer.kafka-report-endpoint;

  reporters = sequencer.whitelisted-reporters;
}
