{
  lib,
  ...
}:

{
  imports = [
    ./example-setup-01.nix
  ];

  services.kafka.enable = true;

  services.blocksense = {
    sequencer.kafka-report-endpoint = lib.mkForce "127.0.0.1:9092";
  };
}
