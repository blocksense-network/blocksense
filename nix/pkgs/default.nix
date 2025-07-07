{
  inputs,
  self,
  ...
}:
{
  perSystem =
    {
      lib,
      pkgs,
      inputs',
      self',
      ...
    }:
    let
      rust = self'.legacyPackages.rustToolchain;

      craneLib = (inputs.mcl-blockchain.inputs.crane.mkLib pkgs).overrideToolchain rust;

      version = "dev";

      blocksense-rs = pkgs.callPackage ./blocksense-rs {
        inherit craneLib version;
        inherit (self.lib) filesets;
      };

      allOracleScripts = pkgs.callPackage ./oracle-script {
        inherit craneLib version;
        inherit (self.lib) filesets;
      };
      mkOracleScript =
        name:
        let
          inherit (self.lib) dashToUnderscore;
          oracleName = dashToUnderscore name;
        in
        pkgs.runCommandLocal "blocksense-oracle-${name}" { } ''
          mkdir -p $out/lib
          ln -s ${allOracleScripts}/lib/${oracleName}.wasm $out/lib/${oracleName}.wasm
        '';

      mkApp = package: exeName: {
        type = "app";
        program = "${package}/bin/${exeName}";
      };

      mkSpinStateDir = pkgs.callPackage ./spin-plugin {
        spin = lib.getExe' inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin "spin";
      };

      # Blama
      blama = pkgs.callPackage ./blama { blama-src = inputs.blama.outPath; };
    in
    {
      apps = {
        sequencer = mkApp blocksense-rs "sequencer";
        reporter = mkApp blocksense-rs "launch_reporter";
        blocksense = mkApp blocksense-rs "blocksense";
        trigger-oracle = mkApp blocksense-rs "trigger-oracle";
        blockchain_reader = mkApp pkgs.apacheKafka "kafka-console-consumer.sh";
        aggregate_consensus_reader = mkApp pkgs.apacheKafka "kafka-console-consumer.sh";
      };
      packages = {
        inherit blocksense-rs;
        inherit blama;
      };
      legacyPackages = {
        oracle-scripts = {
          cex-price-feeds = mkOracleScript "cex-price-feeds";
          exsat-holdings = mkOracleScript "exsat-holdings";
          gecko-terminal = mkOracleScript "gecko-terminal";
          eth-rpc = mkOracleScript "eth-rpc";
          stock-price-feeds = mkOracleScript "stock-price-feeds";
        };

        spinPlugins = {
          triggerOracle = mkSpinStateDir {
            name = "trigger-oracle";
            description = "Run Blocksense oracle components at timed intervals";
            homepage = "https://github.com/blocksense-network/blocksense/tree/main/apps/trigger-oracle";
            license = "Apache-2.0";
            spinCompatibility = ">=2.2";
            version = "0.1.0";
            packages = [ self'.apps.trigger-oracle.program ];
          };
        };
      };
    };
}
