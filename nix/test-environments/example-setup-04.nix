{
  lib,
  ...
}:
let
  root = ../..;
  network = builtins.getEnv "NETWORKS";
  rpcUrl = builtins.getEnv ("RPC_URL_" + lib.strings.toUpper network);
  sequencerAddress = builtins.getEnv ("SEQUENCER_ADDRESS_" + lib.strings.toUpper network);
  testKeysDir = lib.path.append root "nix/test-environments/test-keys";

  # Function to read and parse the JSON file
  readJson = path: builtins.fromJSON (builtins.readFile path);

  # use network
  deploymentV2FilePath = lib.path.append root (
    "config/evm_contracts_deployment_v2/" + network + ".json"
  );

  upgradeableProxyADFSContractAddressInk =
    (readJson deploymentV2FilePath).contracts.coreContracts.UpgradeableProxyADFS.address;
  impersonationAddress = sequencerAddress;
in
{
  imports = [
    ./example-setup-01.nix
  ];

  services.kafka.enable = lib.mkForce false;

  services.blocksense = {
    logsDir = lib.mkForce "$GIT_ROOT/logs/process-compose/example-setup-04";

    blama.enable = lib.mkForce false;

    sequencer = {
      providers = lib.mkForce {
        ink-sepolia = {
          url = rpcUrl;
          private-key-path = "${testKeysDir}/sequencer-private-key";
          transaction-gas-limit = 20000000;
          impersonated-anvil-account = impersonationAddress;
          contracts = [
            {
              name = "AggregatedDataFeedStore";
              address = upgradeableProxyADFSContractAddressInk;
              creation-byte-code = null;
              deployed-byte-code = null;
              contract-version = 2;
            }
            {
              name = "multicall";
              address = "0xcA11bde05977b3631167028862bE2a173976CA11";
              creation-byte-code = null;
              deployed-byte-code = null;
              contract-version = 3;
            }
          ];
        };
      };
    };

    reporters.a.default-exec-interval = lib.mkForce 10;

    oracles = lib.mkForce {
      chicken-farm = {
        exec-interval = 10;
        allowed-outbound-hosts = [
          "http://localhost"
        ];
      };
    };
  };
}
