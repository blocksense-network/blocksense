{
  lib,
  craneLib,
  pkg-config,
  libusb1,
  openssl,
  libgcc,
  zstd,
  stdenv,
  darwin,
  filesets,
  version ? "dev",
}:
let
  sharedAttrs = {
    pname = "oracle-script";
    inherit (filesets.rustSrc) src;

    nativeBuildInputs = [
      pkg-config
    ];

    buildInputs = [
      libusb1
      openssl
      zstd
    ] ++ lib.optionals stdenv.isDarwin [ darwin.apple_sdk.frameworks.Security ];

    env = {
      ZSTD_SYS_USE_PKG_CONFIG = true;
    };

    cargoExtraArgs = "--target wasm32-wasip1";

    doCheck = false;
    strictDeps = true;

    preBuild = ''
      addAutoPatchelfSearchPath ${libgcc.lib}/lib/
    '';
  };

  cargoArtifacts = craneLib.buildDepsOnly (sharedAttrs // { name = "blocksense-cargo-deps"; });
in
craneLib.buildPackage (sharedAttrs // { inherit version cargoArtifacts; })
