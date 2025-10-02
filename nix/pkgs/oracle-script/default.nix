{
  craneLib,
  pkg-config,
  filesets,
  version ? "dev",
}:
let

  sharedAttrs = rec {
    pname = "blocksense-oracle-scripts";
    inherit (filesets.oracleSrc) src;

    nativeBuildInputs = [
      pkg-config
    ];

    postUnpack = ''
      cd $sourceRoot/apps/oracles
      sourceRoot="."
    '';

    cargoToml = ../../../apps/oracles/Cargo.toml;
    cargoLock = ../../../apps/oracles/Cargo.lock;
    cargoExtraArgs = "--target wasm32-wasip1";
    doCheck = false;
    strictDeps = true;
  };

  cargoArtifacts = craneLib.buildDepsOnly (sharedAttrs // { name = "blocksense-cargo-deps"; });
in
craneLib.buildPackage (sharedAttrs // { inherit version cargoArtifacts; })
