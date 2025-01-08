{ inputs, self, ... }:
{
  perSystem =
    { pkgs, self', ... }:
    let
      rust = self'.legacyPackages.rustToolchain;

      craneLib = (inputs.mcl-blockchain.inputs.crane.mkLib pkgs).overrideToolchain rust;

      version = "dev-${
        pkgs.lib.removeSuffix "-dirty" (self.shortRev or self.dirtyShortRev or self.lastModifiedDate)
      }";

      blocksense-rs = pkgs.callPackage ./blocksense-rs {
        inherit (self.lib) filesets;
        inherit craneLib version;
      };

      oracle-script-wasm =
        oracleName:
        pkgs.callPackage ./oracle-script {
          inherit (self.lib) filesets;
          inherit craneLib version;
          oracle-name = oracleName;
        };

      mkApp = package: exeName: {
        type = "app";
        program = "${package}/bin/${exeName}";
      };
    in
    {
      apps = {
        sequencer = mkApp blocksense-rs "sequencer";
        reporter = mkApp blocksense-rs "launch_reporter";
        blocksense = mkApp blocksense-rs "blocksense";
      };
      packages = {
        inherit blocksense-rs;
      };
      legacyPackages = {
        oracle-scripts = {
          cmc-wasm = oracle-script-wasm "cmc";
          yahoo-wasm = oracle-script-wasm "yahoo";
        };
      };
    };
}
