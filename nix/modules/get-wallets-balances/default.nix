{ withSystem, ... }:
{
  flake.modules.nixos.get-wallets-balances =
    {
      pkgs,
      config,
      lib,
      ...
    }:
    let
      cfg = config.services.blocksense.observability-tools.get-wallets-balances;
    in
    {
      options.services.blocksense.observability-tools.get-wallets-balances = with lib; {
        enable = mkEnableOption (lib.mdDoc "Get Wallets Balances");
        rpcUrls = mkOption {
          type = types.listOf types.str;
          description = "The RPC endpoint(s) to connect to the blockchain.";
        };
        sequencerAddress = mkOption {
          type = types.str;
          description = "Sequencer EVM address to check the balance of.";
        };
        package = mkOption {
          type = types.package;
          # TODO: Consider using getSystem from flakeParts
          default = withSystem pkgs.stdenv.hostPlatform.system (
            { config, ... }: config.legacyPackages.yarnProject.onchain-interactions.get-wallets-balances
          );
          description = "The get-wallets-balances package.";
        };
        metrics = {
          enable = mkOption {
            default = true;
            description = "Whether to expose Prometheus metrics.";
            type = lib.types.bool;
          };
          host = mkOption {
            type = types.str;
            default = "0.0.0.0";
          };
          port = mkOption {
            type = types.port;
            default = 9090;
          };
        };
      };
      config = {
        systemd.services.get-wallets-balances = lib.mkIf cfg.enable {
          description = "Get Wallets Balances Service";
          wantedBy = [ "multi-user.target" ];
          serviceConfig = {
            ExecStart =
              ''
                ${lib.getExe cfg.package} \
                --rpc "${lib.concatStringsSep "," cfg.rpcUrls}" \
                --address "${cfg.sequencerAddress}" ''
              + lib.optionalString cfg.metrics.enable ''
                --prometheus \
                --host "${cfg.metrics.host}" \
                --port ${toString cfg.metrics.port}
              '';
          };
        };
      };
    };
}
