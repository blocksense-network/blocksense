{
  config,
  lib,
  ...
}:

let
  testKeysDir = config.devenv.root + "/nix/test-environments/test-keys";
in

{
  imports = [
    ./example-setup-01.nix
  ];

  services.kafka.enable = true;

  services.blocksense = {
    sequencer = {
      kafka-report-endpoint = lib.mkForce "127.0.0.1:9092";
    };

    reporters = {
      a.second-consensus-secret-key-path = "${testKeysDir}/reporter_second_consensus_secret_key";
    };
  };

}
