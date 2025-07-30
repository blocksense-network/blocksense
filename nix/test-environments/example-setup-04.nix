{
  config,
  lib,
  ...
}:
let
  # Function to read and parse the JSON file
  readJson = path: builtins.fromJSON (builtins.readFile path);

  testKeysDir = config.devenv.root + "/nix/test-environments/test-keys";
  deploymentV2FilePath = config.devenv.root + "/config/evm_contracts_deployment_v2/ink-sepolia.json";

  upgradeableProxyADFSContractAddressInk =
    (readJson deploymentV2FilePath).contracts.coreContracts.UpgradeableProxyADFS.address;

  impersonationAddress = lib.strings.fileContents "${testKeysDir}/impersonation_address";
in
{
  services.blocksense = {
    enable = true;

    logsDir = config.devenv.root + "/logs/blocksense";

    # anvil = {
    #   ink-sepolia = {
    #     port = 8080;
    #     # port = 8547;
    #     chain-id = 99999999999;
    #     fork-url = "http://localhost";
    #     # fork-url = "wss://ws-gel-sepolia.inkonchain.com";
    #   };
    # };

    sequencer = {
      id = 1;

      ports = {
        main = 9856;
        admin = 5553;
        metrics = 5551;
      };

      block-config = {
        max-feed-updates-to-batch = 300;
        block-generation-period = 500;
        genesis-block-timestamp-ms = 0;
      };

      providers = {
        mock-provider = {
          url = "http://127.0.0.1:8080/eth/rpc";
          private-key-path = "${testKeysDir}/sequencer-private-key";
          contract-address = upgradeableProxyADFSContractAddressInk;
          contract-version = 2;
          # transaction-gas-limit = 20000000;
          # impersonated-anvil-account = impersonationAddress;

          allow-feeds = [
            69696969 # unix time
          ];

          publishing-criteria = [
            {
              feed-id = 69696969;
              # skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 100; # This might be ignored in favor of the value from the feed config
            }
          ];
        };
      };

      kafka-report-endpoint = null;

      whitelisted-reporters = [
        {
          id = 0;
          pub-key = "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e";
          address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        }
      ];

      log-level = "debug";
    };

    reporters = {
      a = {
        id = 0;
        default-exec-interval = 30;
        secret-key-path = "${testKeysDir}/reporter_secret_key";
        second-consensus-secret-key-path = "${testKeysDir}/reporter_second_consensus_secret_key";
        api-keys = { };
      };
    };

    oracles = {
      dummy-oracle = {
        exec-interval = 5;
        allowed-outbound-hosts = [
          "http://127.0.0.1:8080"
        ];
      };
    };
  };
}
