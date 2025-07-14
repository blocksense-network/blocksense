{
  config,
  lib,
  ...
}:
let
  # Function to read and parse the JSON file
  readJson = path: builtins.fromJSON (builtins.readFile path);

  testKeysDir = config.devenv.root + "/nix/test-environments/test-keys";
  e2eTestKeysDir = config.devenv.root + "/apps/e2e-tests/test-keys";
  deploymentV2FilePath = config.devenv.root + "/config/evm_contracts_deployment_v2/ink-sepolia.json";

  upgradeableProxyADFSContractAddressInk =
    (readJson deploymentV2FilePath).contracts.coreContracts.UpgradeableProxyADFS.address;
  impersonationAddress = lib.strings.fileContents "${testKeysDir}/impersonation_address";
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
        port = 8547;
        chain-id = 99999999999;
        fork-url = "wss://ws-gel-sepolia.inkonchain.com";
      };
    };

    sequencer = {
      providers = lib.mkForce {
        ink-sepolia = {
          url = "http://127.0.0.1:8547";
          private-key-path = "${testKeysDir}/sequencer-private-key";
          contract-address = upgradeableProxyADFSContractAddressInk;
          contract-version = 2;
          transaction-gas-limit = 20000000;
          impersonated-anvil-account = impersonationAddress;
          allow-feeds = [
            # cex-price-feeds oracle feeds
            0 # BTC / USD
            3 # ETH / USD
            7 # USDT / USD
            13 # BNB / USD
            16 # SOL / USD
            19 # USDC / USD
            32 # wBTC / USD
            35 # LINK / USD
            91 # UNI / USD
            114 # AAVE / USD
            121 # TAO / USD
            347 # 1INCH / USD
            50000 # USDT / USD Pegged
            50001 # USDC / USD Pegged

            # exsat-holdings oracle feeds
            100000 # ExSat BTC

            # eth-rpc oracle feeds
            100001 # ynETH MAX (ynETHx) - YieldNest convertToAssets on ETH
            100002 # YieldFi yUSD (yUSD) exchangeRate on ETH mainnet
            100003 # ynBNB MAX (ynBNBx) - YieldNest convertToAssets on BNB

            # gecko-terminal oracle feeds
            1000000 # WMON / USD
            1000001 # USDZ / USD
            1000003 # CHOG / USD

            # stock-price-feeds oracle feeds
            2000000 # IBIT / USD
            2000001 # SPY / USD
          ];
          publishing-criteria = [
            {
              feed-id = 0; # BTC / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 3; # ETH / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 7; # USDT / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 13; # BNB / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 16; # SOL / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 19; # USDC / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 32; # wBTC / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 35; # LINK / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 91; # UNI / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 114; # AAVE / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 121; # TAO / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 347; # 1INCH / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 50000; # USDT / USD Pegged
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
              peg-to-value = 1.00;
              peg-tolerance-percentage = 0.1;
            }
            {
              feed-id = 50001; # USDC / USD Pegged
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
              peg-to-value = 1.00;
              peg-tolerance-percentage = 0.1;
            }
            {
              feed-id = 100000; # ExSat BTC
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 100001; # ynETH MAX (ynETHx) - YieldNest convertToAssets on ETH
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
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
              feed-id = 1000001; # USDZ / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 1000003; # CHOG / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 2000000; # IBIT / USD
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 20000;
            }
            {
              feed-id = 2000001; # SPY / USD
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
