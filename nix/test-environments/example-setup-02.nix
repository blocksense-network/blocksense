{
  lib,
  ...
}:
{
  imports = [
    ./example-setup-01.nix
  ];

  services.blocksense = {
    logsDir = lib.mkForce "$GIT_ROOT/logs/process-compose/example-setup-02";
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
  };
}
