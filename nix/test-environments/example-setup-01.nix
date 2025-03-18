{
  config,
  lib,
  ...
}:
let
  # Function to read and parse the JSON file
  readJson = path: builtins.fromJSON (builtins.readFile path);

  testKeysDir = config.devenv.root + "/nix/test-environments/test-keys";
  deploymentFilePath = config.devenv.root + "/config/evm_contracts_deployment_v1.json";

  upgradeableProxyContractAddressSepolia =
    (readJson deploymentFilePath)."ethereum-sepolia".contracts.coreContracts.UpgradeableProxy.address;
  upgradeableProxyContractAddressHolesky =
    (readJson deploymentFilePath)."ethereum-holesky".contracts.coreContracts.UpgradeableProxy.address;

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
      a = {
        port = 8546;
        chain-id = 99999999999;
        fork-url = "wss://ethereum-sepolia-rpc.publicnode.com";
      };
      b = {
        port = 8547;
        chain-id = 99999999999;
        fork-url = "wss://ethereum-holesky-rpc.publicnode.com";
      };
    };

    sequencer = {
      sequencer-id = 1;
      main-port = 9856;
      admin-port = 5553;
      metrics-port = 5551;

      block-config = {
        max_feed_updates_to_batch = 300;
        block_generation_period = 500;
        genesis_block_timestamp = {
          secs_since_epoch = 1;
          nanos_since_epoch = 1;
        };
      };

      providers = {
        a = {
          # NOTE: this is an example key included directly to make the setup
          # self-contained.
          # In a production environment, use a secret manager like Agenix, to
          # prevent secrets from being copyed to the Nix Store.
          private_key_path = "${testKeysDir}/sequencer-private-key";
          contract_address = upgradeableProxyContractAddressSepolia;
          impersonated_anvil_account = impersonationAddress;
          allow_feeds = [
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
          publishing_criteria = [
            {
              feed_id = 0;
              skip_publish_if_less_then_percentage = 0.001;
              always_publish_heartbeat_ms = 50000; # This might be ignored in favor of the value from the feed config
            }
            {
              feed_id = 3;
              skip_publish_if_less_then_percentage = 0.1;
              always_publish_heartbeat_ms = 360000;
            }
            {
              feed_id = 50000;
              skip_publish_if_less_then_percentage = 0.5;
              always_publish_heartbeat_ms = 360000;
              peg_to_value = 1.00;
              peg_tolerance_percentage = 0.1;
            }
            {
              feed_id = 50001;
              skip_publish_if_less_then_percentage = 0.1;
              always_publish_heartbeat_ms = 360000;
              peg_to_value = 1.00;
              peg_tolerance_percentage = 0.2;
            }
          ];
        };
        b = {
          private_key_path = "${testKeysDir}/sequencer-private-key";
          contract_address = upgradeableProxyContractAddressHolesky;
          transaction_gas_limit = 20000000;
          impersonated_anvil_account = impersonationAddress;
        };
      };

      kafka-report-endpoint = {
        url = null;
      };

      reporters = [
        {
          id = 0;
          pub_key = "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e";
          address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
        }
      ];

      log-level = "info";
    };

    reporters-v2 = {
      a = {
        reporter-info = {
          reporter_id = 0;
          interval_time_in_seconds = 30;
          secret_key = "${testKeysDir}/reporter_secret_key";
        };
        api-keys = { };
      };
    };

    oracles = {
      crypto-price-feeds = {
        oracle_script_wasm = "crypto_price_feeds.wasm";
        capabilities = [ ];
        allowed_outbound_hosts = [
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
        oracle_script_wasm = "exsat_holdings.wasm";
        capabilities = [ ];
        allowed_outbound_hosts = [
          "https://raw.githubusercontent.com"
          "https://rpc-us.exsat.network"
          "https://blockchain.info"
          "https://mempool.space"
        ];
      };

      gecko-terminal = {
        oracle_script_wasm = "gecko_terminal.wasm";
        capabilities = [ ];
        allowed_outbound_hosts = [
          "https://app.geckoterminal.com"
        ];
      };
    };
  };
}
