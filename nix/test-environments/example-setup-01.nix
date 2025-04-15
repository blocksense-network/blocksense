{
  config,
  lib,
  ...
}:
let
  # Function to read and parse the JSON file
  readJson = path: builtins.fromJSON (builtins.readFile path);

  testKeysDir = config.devenv.root + "/nix/test-environments/test-keys";
  deploymentV1FilePath = config.devenv.root + "/config/evm_contracts_deployment_v1.json";
  deploymentV2FilePath = config.devenv.root + "/config/evm_contracts_deployment_v2/ink-sepolia.json";

  upgradeableProxyContractAddressSepolia =
    (readJson deploymentV1FilePath)."ethereum-sepolia".contracts.coreContracts.UpgradeableProxy.address;
  upgradeableProxyADFSContractAddressInk =
    (readJson deploymentV2FilePath).contracts.coreContracts.UpgradeableProxyADFS.address;

  impersonationAddress = lib.strings.fileContents "${testKeysDir}/impersonation_address";
in
{
  services.kafka = {
    enable = true;
  };
  services.blocksense = {
    enable = true;

    logsDir = config.devenv.root + "/logs/blocksense";

    anvil = {
      ethereum-sepolia = {
        port = 8546;
        chain-id = 99999999999;
        fork-url = "wss://ethereum-sepolia-rpc.publicnode.com";
      };
      ink-sepolia = {
        port = 8547;
        chain-id = 99999999999;
        fork-url = "wss://ws-gel-sepolia.inkonchain.com";
      };
    };

    sequencer = {
      sequencer-id = 1;
      main-port = 9856;
      admin-port = 5553;
      metrics-port = 5551;

      block-config = {
        max-feed-updates-to-batch = 300;
        block-generation-period = 500;
        genesis-block-timestamp = {
          secs-since-epoch = 1;
          nanos-since-epoch = 1;
        };
      };

      providers = {
        ethereum-sepolia = {
          # NOTE: this is an example key included directly to make the setup
          # self-contained.
          # In a production environment, use a secret manager like Agenix, to
          # prevent secrets from being copyed to the Nix Store.
          private-key-path = "${testKeysDir}/sequencer-private-key";
          contract-address = upgradeableProxyContractAddressSepolia;
          impersonated-anvil-account = impersonationAddress;
          allow-feeds = [
            0 # BTC / USD
            3 # ETH / USD
            7 # USDT / USD
            19 # USDC / USD
            13 # BNB / USD
            16 # SOL / USD
            32 # wBTC / USD
            35 # LINK / USD
            91 # UNI / USD
            114 # AAVE / USD
            121 # TAO / USD
            347 # 1INCH / USD
            50000 # USDT / USD Pegged
            50001 # USDC / USD Pegged
            100000 # ExSat BTC
            1000000 # WMON 0.2% / USDT
          ];
          publishing-criteria = [
            {
              feed-id = 0;
              skip-publish-if-less-then-percentage = 0.001;
              always-publish-heartbeat-ms = 50000; # This might be ignored in favor of the value from the feed config
            }
            {
              feed-id = 3;
              skip-publish-if-less-then-percentage = 0.1;
              always-publish-heartbeat-ms = 360000;
            }
            {
              feed-id = 50000;
              skip-publish-if-less-then-percentage = 0.5;
              always-publish-heartbeat-ms = 360000;
              peg-to-value = 1.00;
              peg-tolerance-percentage = 0.1;
            }
            {
              feed-id = 50001;
              skip-publish-if-less-then-percentage = 0.1;
              always-publish-heartbeat-ms = 360000;
              peg-to-value = 1.00;
              peg-tolerance-percentage = 0.2;
            }
          ];
        };
        ink-sepolia = {
          private-key-path = "${testKeysDir}/sequencer-private-key";
          contract-address = upgradeableProxyADFSContractAddressInk;
          safe-address = "0x23BC561ea93063B0cD12b6E3c690D40c93e29692";
          contract-version = 2;
          transaction-gas-limit = 20000000;
          impersonated-anvil-account = impersonationAddress;
        };
      };

      kafka-report-endpoint = {
        url = "127.0.0.1:9092";
      };

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
        reporter-info = {
          id = 0;
          interval-time-in-seconds = 30;
          secret-key = "${testKeysDir}/reporter_secret_key";
          second-consensus-secret-key = "${testKeysDir}/reporter_second_consensus_secret_key";
        };
        api-keys = { };
      };
    };

    oracles = {
      crypto-price-feeds = {
        oracle-script-wasm = "crypto_price_feeds.wasm";
        interval-time-in-seconds = 40;
        capabilities = [ ];
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
        oracle-script-wasm = "exsat_holdings.wasm";
        interval-time-in-seconds = 300;
        capabilities = [ ];
        allowed-outbound-hosts = [
          "https://raw.githubusercontent.com"
          "https://rpc-us.exsat.network"
          "https://blockchain.info"
          "https://mempool.space"
        ];
      };

      gecko-terminal = {
        oracle-script-wasm = "gecko_terminal.wasm";
        interval-time-in-seconds = 10;
        capabilities = [ ];
        allowed-outbound-hosts = [
          "https://api.geckoterminal.com"
        ];
      };

      eth-rpc = {
        oracle-script-wasm = "eth_rpc.wasm";
        interval-time-in-seconds = 10;
        capabilities = [ ];
        allowed-outbound-hosts = [
          "https://eth.llamarpc.com"
          "https://rpc.eth.gateway.fm"
        ];
      };
    };
  };
}
