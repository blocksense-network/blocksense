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
  imports = [
    ./example-setup-01.nix
  ];

  services.blocksense = {
    logsDir = lib.mkForce (config.devenv.root + "/logs/blocksense/example-setup-04");

    anvil = lib.mkForce {
      ink-sepolia = {
        port = 8547;
        chain-id = 99999999999;
        fork-url = "wss://ws-gel-sepolia.inkonchain.com";
      };
    };

    sequencer = {
      block-config = lib.mkForce {
        block-generation-period = 100; # This are ms ( we have hacked the SDK to use ms instead of seconds )
      };
      log-level = lib.mkForce "debug";
      providers = lib.mkForce {
        ink-sepolia = {
          url = "http://127.0.0.1:8547";
          private-key-path = "${testKeysDir}/sequencer-private-key";
          contract-address = upgradeableProxyADFSContractAddressInk;
          contract-version = 2;
          transaction-gas-limit = 20000000;
          impersonated-anvil-account = impersonationAddress;
        };
      };
    };

    reporters.a.default-exec-interval = lib.mkForce 1;

    oracles = lib.mkForce {
      mock = {
        exec-interval = 250; # This are ms ( we have hacked the SDK to use ms instead of seconds )
        allowed-outbound-hosts = [ ];
      };
    };
  };
}
