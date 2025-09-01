{
  config,
  lib,
  ...
}:
let
  network = builtins.getEnv "NETWORKS";
  rpcUrl = builtins.getEnv ("RPC_URL_" + lib.strings.toUpper network);
  sequencerAddress = builtins.getEnv ("SEQUENCER_ADDRESS_" + lib.strings.toUpper network);
  # sequencerPrivateKeyPath = builtins.getEnv (
  #   "SEQUENCER_PRIVATE_KEY_PATH_" + lib.strings.toUpper network
  # );

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

  root = ../..;

  availablePorts =
    let
      filePath = "${config.devenv.root}/config/generated/process-compose/example-setup-03/available-ports";
      ports = if builtins.pathExists filePath then readPortsFromFile filePath else [ ];
    in
    if builtins.length ports > 0 then ports else [ 8547 ];
  testKeysDir = lib.path.append root "nix/test-environments/test-keys";
  # use network
  deploymentV2FilePath = lib.path.append root (
    "config/evm_contracts_deployment_v2/" + network + ".json"
  );

  upgradeableProxyADFSContractAddressInk =
    (readJson deploymentV2FilePath).contracts.coreContracts.UpgradeableProxyADFS.address;
  impersonationAddress = sequencerAddress;
  anvilInkSepoliaPort = builtins.elemAt availablePorts 0;
in
{
  imports = [
    ./example-setup-01.nix
  ];

  services.kafka.enable = lib.mkForce false;

  services.blocksense = {
    logsDir = lib.mkForce "$GIT_ROOT/logs/process-compose/example-setup-04";

    blama.enable = lib.mkForce false;

    # anvil = lib.mkForce {
    #   ink-sepolia = {
    #     port = anvilInkSepoliaPort;
    #     chain-id = 99999999999;
    #     fork-url = "wss://ws-gel-sepolia.inkonchain.com";
    #   };
    # };

    sequencer = {
      providers = lib.mkForce {
        ink-sepolia = {
          url = rpcUrl;
          private-key-path = "${testKeysDir}/sequencer-private-key";
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
          contracts = [
            {
              name = "AggregatedDataFeedStore";
              address = upgradeableProxyADFSContractAddressInk;
              creation-byte-code = null;
              deployed-byte-code = null;
              contract-version = 2;
            }
            {
              name = "multicall";
              address = "0xcA11bde05977b3631167028862bE2a173976CA11";
              creation-byte-code = null;
              deployed-byte-code = null;
              contract-version = 3;
            }
          ];
        };
      };
    };

    reporters.a.default-exec-interval = lib.mkForce 10;

    oracles = lib.mkForce {
      chicken = {
        exec-interval = 10;
        allowed-outbound-hosts = [
          "http://localhost"
        ];
      };
    };
  };
}
