{ config, ... }:
{
  services.blocksense = {
    enable = true;

    anvil = {
      a.port = 8546;
      b.port = 1234;
    };

    sequencer = {
      main-port = 9856;
      admin-port = 5553;
      metrics-port = 5551;
      max-keys-to-batch = 1;
      keys-batch-duration = 500;

      providers = {
        a = {
          # NOTE: this is an example key included directly to make the setup
          # self-contained.
          # In a production environment, use a secret manager like Agenix, to
          # prevent secrets from being copyed to the Nix Store.
          private_key_path = ./test-keys/anvil-acc1-private-key;
          contract_address = "0x663F3ad617193148711d28f5334eE4Ed07016602";
        };
        b = {
          private_key_path = ./test-keys/anvil-acc1-private-key;
          contract_address = "0x663F3ad617193148711d28f5334eE4Ed07016602";
        };
      };

      feeds = {
        DOGE = { };
        BTC = { };
        ETH = { };
        SHIB = { };
        SOL = { };
        DOT = { };
        XRP = { };
        AAPL = { };
        GOOGL = { };
        TSLA = { };
        IBKR = { };
        NVDA = { };
        TLRY = { };
        AMD = { };
      };

      reporters = [
        "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e"
        "ea30a8bd97d4f78213320c38215e95b239f8889df885552d85a50665b8b802de85fb40ae9b72d3f67628fa301e81252cd87e"
        "ea308dc64491fa5d52783f1b5b0fd91a9045e6d6c7e6d7e837d6cf6ac47181f54ae871dbc9b6b3119832677f1cbdfd927bd5"
        "ea308a6d5b6d211d182afdc5db42d7938b5eeb5d65c3f089e34d1e7708bb3ad0a4ee238690315f77b65c2c30e85b0de2b0ab"
        "ea30954eb3dab19c9e418bbd880e2cf74d87de9ccc6144822aa42b3215cfa4d61b70bd7a9a4cac88df712ea6c7cc392f8272"
        "ea30a94aa82d5da309f726a32bad10558b4da192a6c372800dfb3c0359108afeedb367a200d09fa12312992ba008b40d8b22"
        "ea30b9c6352a85b16fa5eb2d5a2cbb2e020b7b08801fc207e939c4daa0c7047ec320ce3ed820a4a8b6e01ac5ebf50e2a008e"
        "ea30a001897cd763a38332be7cbe5cfa4d6dc50f2d1dcce34c1b38107dc24da97906886fddac1dd373229053bfd0d353e5eb"
        "ea30b86dd693a688a1224ff1572ee3c5261694c4f2e17739a0bd69bb96a740aaf437780b8c6c6c1be02541ca874839bffa39"
        "ea309689013ed6acd4932b1ac1fedf9eabdfe32f758f279056ca290fa7bb3be2e267f74d7bea00ecbac6d23c89b9cf00d02a"
        "ea3089f25fff1ce40432cebd063b6451b9c72cf2d53502bcda977bb3f8d45eb887c178754c1bfc494f9a7afe9f0f1c1b5ba7"
        "ea30999fbd6f7d66d573db14cb894892da6a6b783427240e54f8c61d4c7e8227ac29bf8100f317a6a41fc9ff3a541977e175"
        "ea3092d1f91b09353b5c529a2161dee1ec5550e26481c1285d978272450933073d0668d2635d5ef077126929d9bc44afb975"
        "ea30899126de3704cffd1ac6fcaa78439fcacf9ccb78a27bcb88329d88841ba925cdb257cb7b2695bb5ae749b337344427a3"
        "ea30a8227e06d4b028c643713ba657c48503f19c53a114056f89e3e05bde4c95de45afa1da53eb426da98ebfd6d0a3e1f7f7"
        "ea30b744fe09bb490e94f0dd973e322d92a2365a444cbaa7abd08a2725f6448c586db6cd146ace9b1049daaa850947ea7802"
        "ea30a883337bd791e68b2cc63f35448a6dd4aa5b66bb1763fd43c4a6ec8ae9bd67f1fe5f7000b810ecdc26d961dd61afb100"
        "ea30b1533ef5638af7b70a036275642fc453ace97ed2c6b9d220fe1f59a24d61f481a777aa8a579f20e95a74cd4567ed36a3"
        "ea30813e2f8cf968e27bad29167b41bce038a3ce9b7b368de05e5cf1af3de919eeba267b8706f55c356d5f71891eff116b98"
        "ea30b442850f8467f40cce47083d1087e59e4ebb36a1a0f3320304296a004f72d825cf39f7e497154601e0a7ec9c8642dad0"
        "ea3089d6cf5d17f32df879a33a53748d40b5eecbcff8c21c99e1cfe7cda0c6379d584a6985b7eb2c6a52ee57b2edacff69c8"
        "ea30864c4fd418a5a3b51de505482527fc593e12964467351007ab518c7c0053ee7b45c9f8eeced86249a9f92a4014d91b44"
        "ea3083ada562784f82953785128f443af35c1540cca35d31cda798d6033d7be38e479d90c3958f1afcc64cc602bab893e09d"
        "ea3099e877031313f6b2fb95f7c0e62598e07e0dfb674a9341ce8164e046342c326632aa673ad52d684bb06951e67af60a59"
        "ea308312d7827e94fd168f3f7abb33d3044925b4991d7d5cdb63cac564f3ddbceffa236befacbe38e420b7d304a5c411fad3"
        "ea3095e59b7f3cf7d8b798bfb6c6c88825cc4afcad077e2c60dfb92aba32e36b485365042b0347e1fc3dc3565324783e4aef"
        "ea30a59d77c6e481c9b5ef1f4d3a1e607203020bcb3f1954449f6722dcb1014bfd045972a711dae243a090c955ac383cc211"
        "ea30a74db768a6c725fbe585e90d50bb18a2d6bf7cd28693b064e4dfabc30084eee9fd34a0ebf1263d7154ef22f73e928148"
        "ea30b85dd47539331ed300a153afad52de9b52a0645d527b6039b6b1b3bceb29961515ec2a763def112a37df0535b73e11c0"
        "ea30b7188c27a43210d03b456ca4b77daf8e8feb3c183d955d809545969b54bcc975a204ee598108bc1eaa64d1da05ebe917"
      ];
    };

    reporters = {
      a = {
        batch-size = 5;
        resources = {
          SECRET_KEY_PATH = ./test-keys/reporter_secret_key;
          CMC_API_KEY_PATH = config.devenv.root + "/apps/reporter/CMC_API_KEY";
        };
        reporter = {
          pub_key = "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e";
        };
        feeds = {
          "CoinMarketCap.DOGE" = { };
          "CoinMarketCap.BTC" = { };
          "CoinMarketCap.ETH" = { };
          "CoinMarketCap.SHIB" = { };
          "CoinMarketCap.SOL" = { };
          "CoinMarketCap.DOT" = { };
          "CoinMarketCap.XRP" = { };
          "YahooFinance.AAPL" = { };
          "YahooFinance.GOOGL" = { };
          "YahooFinance.TSLA" = { };
          "YahooFinance.IBKR" = { };
          "YahooFinance.NVDA" = { };
          "YahooFinance.TLRY" = { };
          "YahooFinance.AMD" = { };
        };
      };
    };
  };
}
