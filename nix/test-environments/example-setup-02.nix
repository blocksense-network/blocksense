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
      providers = {
        ink-sepolia.contracts = [
          {
            name = "gnosis_safe";
            address = "0x23BC561ea93063B0cD12b6E3c690D40c93e29692";
            contract-version = 2;
            min-quorum = 1;
          }
        ];
      };
    };

    reporters = {
      a.second-consensus-secret-key-path = "${testKeysDir}/reporter_second_consensus_secret_key";
    };
  };
}
