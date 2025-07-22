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

  availablePorts =
    let
      filePath = "${config.devenv.root}/config/generated/process-compose/available-ports";
    in
    if builtins.pathExists filePath then readPortsFromFile filePath else [ 8547 ];

  testKeysDir = config.devenv.root + "/nix/test-environments/test-keys";
  e2eTestKeysDir = config.devenv.root + "/apps/e2e-tests/test-keys";
  deploymentV2FilePath = config.devenv.root + "/config/evm_contracts_deployment_v2/ink-sepolia.json";

  upgradeableProxyADFSContractAddressInk =
    (readJson deploymentV2FilePath).contracts.coreContracts.UpgradeableProxyADFS.address;
  impersonationAddress = lib.strings.fileContents "${testKeysDir}/impersonation_address";
  anvilInkSepoliaPort = builtins.elemAt availablePorts 0;
in
{
  imports = [
    ./example-setup-01.nix
  ];

  services.kafka.enable = lib.mkForce false;

  services.blocksense = {
    logsDir = lib.mkForce (config.devenv.root + "/logs/process-compose/example-setup-03");

    blama.enable = lib.mkForce false;

    anvil = lib.mkForce {
      ink-sepolia = {
        port = anvilInkSepoliaPort;
        chain-id = 99999999999;
        fork-url = "wss://ws-gel-sepolia.inkonchain.com";
      };
    };

    sequencer = {
      providers = lib.mkForce {
        ink-sepolia = {
          url = "http://127.0.0.1:${toString anvilInkSepoliaPort}";
          private-key-path = "${testKeysDir}/sequencer-private-key";
          contract-address = upgradeableProxyADFSContractAddressInk;
          contract-version = 2;
          transaction-gas-limit = 20000000;
          impersonated-anvil-account = impersonationAddress;
          publishing-criteria = [
            {
              feed-id = 50000; # USDT / USD Pegged
              peg-to-value = 1.00;
              peg-tolerance-percentage = 0.1;
            }
            {
              feed-id = 50001; # USDC / USD Pegged
              peg-to-value = 1.00;
              peg-tolerance-percentage = 0.1;
            }
            {
              feed-id = 100002; # YieldFi yUSD (yUSD) exchangeRate on ETH mainnet
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 100003; # ynBNB MAX (ynBNBx) - YieldNest convertToAssets on BNB
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 1000000; # WMON / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 1000003; # CHOG / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 1000008; # cbBTC / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
          ];
        };
      };
    };

    reporters.a.default-exec-interval = lib.mkForce 10;
    reporters.a.api-keys = lib.mkForce {
      ALPHAVANTAGE_API_KEY = "${e2eTestKeysDir}/ALPHAVANTAGE_API_KEY";
      APCA_API_KEY_ID = "${e2eTestKeysDir}/APCA_API_KEY_ID";
      APCA_API_SECRET_KEY = "${e2eTestKeysDir}/APCA_API_SECRET_KEY";
      YAHOO_FINANCE_API_KEY = "${e2eTestKeysDir}/YAHOO_FINANCE_API_KEY";
      TWELVEDATA_API_KEY = "${e2eTestKeysDir}/TWELVEDATA_API_KEY";
      FMP_API_KEY = "${e2eTestKeysDir}/FMP_API_KEY";
      SPOUT_RWA_API_KEY = "${e2eTestKeysDir}/SPOUT_RWA_API_KEY";
    };

    oracles = {
      cex-price-feeds.exec-interval = lib.mkForce 10;
      exsat-holdings.exec-interval = lib.mkForce 10;
      gecko-terminal.exec-interval = lib.mkForce 10;
      eth-rpc.exec-interval = lib.mkForce 10;
      stock-price-feeds.exec-interval = lib.mkForce 10;
    };
  };
}
