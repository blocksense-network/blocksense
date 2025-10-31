{
  config,
  lib,
  ...
}:
let
  # Function to read and parse the JSON file
  readJson = path: builtins.fromJSON (builtins.readFile path);

  readPortsFromFile =
    path:
    let
      content = builtins.readFile path;
      lines = lib.strings.splitString "\n" content;
      nonEmpty = builtins.filter (s: s != "") lines;
      asInts = builtins.map builtins.fromJSON nonEmpty;
    in
    asInts;

  root = ../../../../..;

  availablePorts =
    let
      filePath = "${config.devenv.root}/config/generated/process-compose/e2e-wit/available-ports";
      ports = if builtins.pathExists filePath then readPortsFromFile filePath else [ ];
    in
    if builtins.length ports > 0 then ports else [ 8547 ];
  testKeysDir = lib.path.append root "nix/test-environments/test-keys";
  deploymentV2FilePath = lib.path.append root "config/evm_contracts_deployment_v2/ink-sepolia.json";

  upgradeableProxyADFSContractAddressInk =
    (readJson deploymentV2FilePath).contracts.coreContracts.UpgradeableProxyADFS.address;
  impersonationAddress = lib.strings.fileContents "${testKeysDir}/impersonation_address";
  anvilInkSepoliaPort = builtins.elemAt availablePorts 0;

  reporterStateDir = "."; # Reporters start from .devenv/state/blocksense/reporter/<name>
  apiKeysDir = "${reporterStateDir}/test-keys";
in
{
  services.kafka = {
    enable = false;
  };

  services.blocksense = {
    enable = true;

    logsDir = "$GIT_ROOT/logs/process-compose/e2e-wit";

    anvil = {
      ink-sepolia = {
        port = anvilInkSepoliaPort;
        chain-id = 99999999999;
        fork-url = "$RPC_URL_INK_SEPOLIA";
        fork-block-number = 29297247;
        fork-chain-id = 11155111;
        state = "${config.devenv.root}/config/generated/process-compose/e2e-wit/anvil/state.json";
        state-interval = 10;
      };
    };

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
        ink-sepolia = {
          is-enabled = false;
          url = "http://127.0.0.1:${toString anvilInkSepoliaPort}";
          private-key-path = "${testKeysDir}/sequencer-private-key";
          transaction-gas-limit = 20000000;
          impersonated-anvil-account = impersonationAddress;
          publishing-criteria = [
            {
              feed-id = 50000; # USDT / USD Pegged
              peg-to-value = 1.00;
              peg-tolerance-percentage = 10.0; # 10% tolerance assures that the price will be pegged
            }
            {
              feed-id = 50001; # USDC / USD Pegged
              peg-to-value = 1.00;
              peg-tolerance-percentage = 0.000001; # 0.000001% tolerance assures that the price will not be pegged
            }
          ];
          contracts = [
            {
              name = "AggregatedDataFeedStore";
              address = upgradeableProxyADFSContractAddressInk;
              creation-byte-code = null;
              deployed-byte-code = null;
            }
            {
              name = "multicall";
              address = "0xcA11bde05977b3631167028862bE2a173976CA11";
              creation-byte-code = null;
              deployed-byte-code = null;
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

      pyroscope-config = {
        url = "http://localhost:4040";
      };

      log-level = "info";
    };

    reporters = {
      a = {
        id = 0;
        default-exec-interval = 10;
        secret-key-path = "${testKeysDir}/reporter_secret_key";
        second-consensus-secret-key-path = "${testKeysDir}/reporter_second_consensus_secret_key";
      };
    };

    oracles = {
      sports-db = {
        exec-interval = 120;
        allowed-outbound-hosts = [
          "https://www.thesportsdb.com"
        ];
      };
    };
  };
}
