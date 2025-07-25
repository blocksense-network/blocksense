{
  config,
  lib,
  ...
}:
let
  cfg = config.services.blocksense;

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
        host = "127.0.0.1";
        port = anvilInkSepoliaPort;
        chain-id = 99999999999;
        fork-url = "wss://ws-gel-sepolia.inkonchain.com";
      };
    };

    sequencer = {
      providers = lib.mkForce {
        ink-sepolia = {
          url = "http://anvil-ink-sepolia:${toString anvilInkSepoliaPort}";
          private-key-path = "/run/secrets/blocksense-sequencer-evm-priv-key";
          contract-address = upgradeableProxyADFSContractAddressInk;
          contract-version = 2;
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
        };
      };
    };

    reporters.a = {
      sequencer-url = "http://blocksense-reporter:${toString cfg.sequencer.ports.main}";
      default-exec-interval = lib.mkForce 10;
      secret-key-path = lib.mkForce "/run/secrets/blocksense-reporter-bls-priv-key";
      second-consensus-secret-key-path = lib.mkForce "/run/secrets/blocksense-reporter-evm-priv-key";
      api-keys = lib.mkForce {
        ALPHAVANTAGE_API_KEY = lib.mkForce "/run/secrets/blocksense-reporter-alphavantage-api-key";
        APCA_API_KEY_ID = lib.mkForce "/run/secrets/blocksense-reporter-apca-api-key-id";
        APCA_API_SECRET_KEY = lib.mkForce "/run/secrets/blocksense-reporter-apca-api-secret-key";
        YAHOO_FINANCE_API_KEY = lib.mkForce "/run/secrets/blocksense-reporter-fmp-api-key";
        TWELVEDATA_API_KEY = lib.mkForce "/run/secrets/blocksense-reporter-spout-rwa-api-key";
        FMP_API_KEY = lib.mkForce "/run/secrets/blocksense-reporter-twelvedata-api-key";
        SPOUT_RWA_API_KEY = lib.mkForce "/run/secrets/blocksense-reporter-yahoo-finance-api-key";
      };
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
