{
  self,
  cfg,
  ...
}:
let
  inherit (self.lib) dashToUnderscoreRecursive;
in
dashToUnderscoreRecursive {
  inherit (cfg.sequencer)
    block-config
    providers
    http-input-buffer-size
    pyroscope-config
    ;

  sequencer-id = cfg.sequencer.id;

  prometheus-port = cfg.sequencer.ports.metrics;
  admin-port = cfg.sequencer.ports.admin;
  main-port = cfg.sequencer.ports.main;

  kafka-report-endpoint.url = cfg.sequencer.kafka-report-endpoint;

  reporters = cfg.sequencer.whitelisted-reporters;
}
