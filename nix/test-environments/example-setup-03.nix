{
  config,
  lib,
  ...
}:
let
  # Function to read and parse the JSON file
  # readJson = path: builtins.fromJSON (builtins.readFile path);

  testKeysDir = config.devenv.root + "/nix/test-environments/test-keys";
  # deploymentV2FilePath = config.devenv.root + "/config/evm_contracts_deployment_v2/ink-sepolia.json";

  upgradeableProxyADFSContractAddressInk = "0xADF5aacfA254FbC566d3b81e04b95db4bCF7b40F";
  # TODO:(milagenova): once we merge latest deployment files we can use the line below
  # (readJson deploymentV2FilePath).contracts.coreContracts.UpgradeableProxyADFS.address;
  impersonationAddress = lib.strings.fileContents "${testKeysDir}/impersonation_address";
in
{
  services.blocksense = {
    enable = true;

    logsDir = config.devenv.root + "/logs/blocksense/example-setup-03";

    anvil = {
      ink-sepolia = {
        port = 8547;
        chain-id = 99999999999;
        fork-url = "wss://ws-gel-sepolia.inkonchain.com";
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
          private-key-path = "${testKeysDir}/sequencer-private-key";
          contract-address = upgradeableProxyADFSContractAddressInk;
          contract-version = 2;
          transaction-gas-limit = 20000000;
          impersonated-anvil-account = impersonationAddress;
          allow-feeds = [
            # crypto-price-feeds oracle feeds
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

      kafka-report-endpoint = null;

      whitelisted-reporters = [
        {
          id = 0;
          pub-key = "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e";
          address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        }
      ];

      log-level = "info";
    };

    reporters = {
      a = {
        id = 0;
        default-exec-interval = 10;
        secret-key-path = "${testKeysDir}/reporter_secret_key";
        api-keys = {
          ALPHAVANTAGE_API_KEY = "${testKeysDir}/ALPHAVANTAGE_API_KEY";
          YAHOO_FINANCE_API_KEY = "${testKeysDir}/YAHOO_FINANCE_API_KEY";
          TWELVEDATA_API_KEY = "${testKeysDir}/TWELVEDATA_API_KEY";
          FMP_API_KEY = "${testKeysDir}/FMP_API_KEY";
        };
      };
    };

    oracles = {
      crypto-price-feeds = {
        exec-interval = 10;
        allowed-outbound-hosts = [
          "https://api.kraken.com"
          "https://api.bybit.com"
          "https://api.coinbase.com"
          "https://api.exchange.coinbase.com"
          "https://api1.binance.com"
          "https://api.kucoin.com"
          "https://api.mexc.com"
          "https://api.crypto.com"
          "https://api.binance.us"
          "https://api.gemini.com"
          "https://api-pub.bitfinex.com"
          "https://api.upbit.com"
          "https://api.bitget.com"
          "https://api.gateio.ws"
          "https://www.okx.com"
        ];
      };

      exsat-holdings = {
        exec-interval = 10;
        allowed-outbound-hosts = [
          "https://raw.githubusercontent.com"
          "https://rpc-us.exsat.network"
          "https://blockchain.info"
          "https://mempool.space"
        ];
      };

      gecko-terminal = {
        exec-interval = 10;
        allowed-outbound-hosts = [
          "https://api.geckoterminal.com"
        ];
      };

      eth-rpc = {
        exec-interval = 10;
        allowed-outbound-hosts = [
          "https://eth.llamarpc.com"
          "https://rpc.eth.gateway.fm"
          "https://ethereum-rpc.publicnode.com"
          "https://binance.llamarpc.com"
          "https://bsc.meowrpc.com"
          "https://bsc.drpc.org"
        ];
      };

      stock-price-feeds = {
        exec-interval = 10;
        allowed-outbound-hosts = [
          "https://www.alphavantage.co"
          "https://yfapi.net"
          "https://api.twelvedata.com"
          "https://financialmodelingprep.com"
        ];
        api-keys = [
          "ALPHAVANTAGE_API_KEY"
          "YAHOO_FINANCE_API_KEY"
          "TWELVEDATA_API_KEY"
          "FMP_API_KEY"
        ];
      };
    };
  };
}
