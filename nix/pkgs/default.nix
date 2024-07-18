{ inputs, self, ... }:
{
  perSystem =
    { pkgs, self', ... }:
    let
      rust = self'.legacyPackages.rustToolchain;

      rustPlatform = pkgs.makeRustPlatform {
        cargo = rust;
        rustc = rust;
      };

      craneLib = (inputs.mcl-blockchain.inputs.crane.mkLib pkgs).overrideToolchain rust;

      blocksense-rs = pkgs.callPackage ./blocksense-rs {
        inherit (self.lib) filesets;
        inherit craneLib;
      };

      mkApp = package: exeName: {
        type = "app";
        program = "${package}/bin/${exeName}";
      };
    in
    {
      apps = {
        sequencer = mkApp blocksense-rs "sequencer";
      };
      packages = {
        inherit blocksense-rs;
      };
    };
}
