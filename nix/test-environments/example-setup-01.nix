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
  services.blocksense = {
    enable = true;

    logsDir = config.devenv.root + "/logs/blocksense";

    anvil = {
      # a = {
      #   port = 8546;
      #   chain-id = 99999999999;
      #   fork-url = "wss://ethereum-sepolia-rpc.publicnode.com";
      # };
      # b = {
      #   port = 8547;
      #   chain-id = 99999999999;
      #   fork-url = "wss://ethereum-holesky-rpc.publicnode.com";
      # };
    };

    sequencer = {
      main-port = 9856;
      admin-port = 5553;
      metrics-port = 5551;
      max-keys-to-batch = 300;
      keys-batch-duration = 500;

      providers = {
        # a = {
        #   # NOTE: this is an example key included directly to make the setup
        #   # self-contained.
        #   # In a production environment, use a secret manager like Agenix, to
        #   # prevent secrets from being copyed to the Nix Store.
        #   private_key_path = "${testKeysDir}/sequencer-private-key";
        #   contract_address = upgradeableProxyContractAddressSepolia;
        #   impersonated_anvil_account = impersonationAddress;
        # };
        # b = {
        #   private_key_path = "${testKeysDir}/sequencer-private-key";
        #   contract_address = upgradeableProxyContractAddressHolesky;
        #   transaction_gas_limit = 20000000;
        #   allow_feeds = [
        #     31 # BTC/USD
        #     47 # ETH/USD
        #     236 # USDT/USD
        #     131 # USDC/USD
        #     43 # WBTC/USD
        #   ];
        #   impersonated_anvil_account = impersonationAddress;
        # };
      };

      reporters = [
        "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e"
      ];

      log-level = "info";
    };

    reporters = {
      a = {
        full-batch = true;
        batch-size = 5;
        resources = {
          SECRET_KEY_PATH = "${testKeysDir}/reporter_secret_key";
          CMC_API_KEY_PATH = "${testKeysDir}/CMC_API_KEY";
          YH_FINANCE_API_KEY_PATH = "${testKeysDir}/YH_FINANCE_API_KEY";
        };
        reporter = {
          pub_key = "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e";
        };
      };
    };
  };
}
