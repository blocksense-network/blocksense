{
  craneLib,
  pkg-config,
  filesets,
  version ? "dev",
  oracle-name,
}:
let
  sharedAttrs = rec {
    pname = "oracle-script-${oracle-name}";
    inherit (filesets.rustSrc) src;

    postUnpack = ''
      cd $sourceRoot/libs/sdk/examples/${oracle-name}
      sourceRoot="."
    '';

    cargoLock = ../../../libs/sdk/examples/${oracle-name}/Cargo.lock;
    cargoToml = ../../../libs/sdk/examples/${oracle-name}/Cargo.toml;

    nativeBuildInputs = [
      pkg-config
    ];

    cargoExtraArgs = "--target wasm32-wasip1";
    doCheck = false;
    strictDeps = true;
  };

  cargoArtifacts = craneLib.buildDepsOnly (sharedAttrs // { name = "blocksense-cargo-deps"; });
in
craneLib.buildPackage (sharedAttrs // { inherit version cargoArtifacts; })
