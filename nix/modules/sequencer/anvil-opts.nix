{ lib, ... }:
with lib;
let
  walletOpts = {
    address.file = mkOption {
      type = with types; nullOr path;
      description = "The path to the wallet address";
    };
    private-key.file = mkOption {
      type = with types; nullOr path;
      default = null;
      description = "The path of the wallet private key";
    };
  };
in
{
  options = {
    port = mkOption {
      type = types.int;
      default = 8544;
      description = "The port to use for the Anvil instance.";
    };

    chain-id = mkOption {
      type = types.int;
      default = 99999999999;
      description = "The chain ID to use for the Anvil instance.";
    };

    fork-url = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "The fork URL to use for the Anvil instance.";
    };

    contract-deployment = {
      enable = mkEnableOption "Enable deployment of Blocksense contracts on Anvil simulation environment.";
      deployer = walletOpts;
      sequencer = walletOpts;
    };
  };
}
