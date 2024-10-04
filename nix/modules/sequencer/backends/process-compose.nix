{ self, inputs }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.blocksense;

  inherit (pkgs) system;
  inherit (self.apps.${system}) sequencer reporter;
  inherit (self.legacyPackages.${system}) foundry;

  sequencerConfigJSON = pkgs.runCommandLocal "sequencer_config" { } ''
    mkdir -p $out
    echo '${cfg._sequencer-config-txt}' \
      | ${lib.getExe pkgs.jq} > $out/sequencer_config.json
  '';

  reportersConfigJSON = builtins.mapAttrs (
    n: v:
    pkgs.runCommandLocal "reporter_config" { } ''
      mkdir -p $out/reporter-${n}
      echo '${cfg._reporters-config-txt.${n}}' \
        | ${lib.getExe pkgs.jq} > $out/reporter-${n}/reporter_config.json
    ''
  ) cfg.reporters;

  anvilInstances = lib.mapAttrs' (
    name:
    {
      port,
      chain-id,
      fork-url,
      contract-deployment,
    }:
    {
      name = "anvil-${name}";
      value.process-compose = {
        command =
          ''
            ${foundry}/bin/anvil \
              --port ${toString port} \
              --chain-id ${toString chain-id} \
          ''
          + lib.optionalString (fork-url != null) ''
            --fork-url ${fork-url}
          '';
        readiness_probe = {
          exec.command = ''
            curl -fsSL http://127.0.0.1:${toString port}/ \
              -H 'content-type: application/json' \
              --data-raw '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":0}'
          '';
          timeout_seconds = 30;
        };
      };
    }
  ) cfg.anvil;

  smartContractDeploymentInstances = lib.mapAttrs' (
    name:
    { port, contract-deployment, ... }:
    {
      name = "smartContract-${name}";
      value.process-compose = lib.mkIf contract-deployment.enable {
        command = ''
          yarn && \
          yarn build @blocksense/contracts && \
          yarn workspace '@blocksense/contracts' hardhat deploy --networks local
        '';
        environment = [
          "RPC_URL_LOCAL=http://127.0.0.1:${toString port}/"
          "SEQUENCER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
          "SIGNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        ];
        depends_on."anvil-${name}".condition = "process_healthy";
      };

    }

  ) cfg.anvil;

  reporterInstances = lib.mapAttrs' (name: conf: {
    name = "blocksense-reporter-${name}";
    value.process-compose = {
      command = "${reporter.program}";
      environment = [
        "FEEDS_CONFIG_DIR=${../../../../config}"
        "REPORTER_CONFIG_DIR=${reportersConfigJSON.${name}}/reporter-${name}"
        "RUST_LOG=${conf.log-level}"
      ];
      shutdown.signal = 9;
    };
  }) cfg.reporters;

  sequencerInstance = {
    blocksense-sequencer.process-compose = {
      command = "${sequencer.program}";
      environment = [
        "FEEDS_CONFIG_DIR=${../../../../config}"
        "SEQUENCER_CONFIG_DIR=${sequencerConfigJSON}"
        "SEQUENCER_LOG_LEVEL=${lib.toUpper cfg.sequencer.log-level}"
      ];
      shutdown.signal = 9;
    };
  };

in
{
  config = lib.mkIf cfg.enable {
    processes =
      sequencerInstance // anvilInstances // smartContractDeploymentInstances // reporterInstances;
  };
}
