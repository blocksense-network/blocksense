{
  config,
  lib,
  ...
}:
let
  cfg = config.services.blocksense;

  testKeysDir = config.devenv.root + "/nix/test-environments/test-keys";

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
        host = "anvil-ink-sepolia";
        chain-id = 99999999999;
        fork-url = "wss://ws-gel-sepolia.inkonchain.com";
      };
    };

    sequencer = {
      host = "blocksense-sequencer";
      providers = lib.mkForce {
        ink-sepolia = {
          private-key-path = "/run/secrets/blocksense-sequencer-evm-priv-key";
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
