{ inputs, self, ... }:
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

      mkOracleScript =
        oracle-name:
        pkgs.callPackage ./oracle-script {
          inherit craneLib version oracle-name;
          inherit (self.lib) filesets;
        };

      mkApp = package: exeName: {
        type = "app";
        program = "${package}/bin/${exeName}";
      };

      mkSpinStateDir = pkgs.callPackage ./spin-plugin {
        spin = lib.getExe' inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin "spin";
      };
    in
    {
      apps = {
        sequencer = mkApp blocksense-rs "sequencer";
        reporter = mkApp blocksense-rs "launch_reporter";
        blocksense = mkApp blocksense-rs "blocksense";
        trigger-oracle = mkApp blocksense-rs "trigger-oracle";
      };
      packages = {
        inherit blocksense-rs;
      };
      legacyPackages = {
        oracle-scripts = {
          cmc-wasm = mkOracleScript "cmc";
          yahoo-wasm = mkOracleScript "yahoo";
          exsat-wasm = mkOracleScript "exsat_network";
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
