{
  lib,
  craneLib,
  pkg-config,
  libusb,
  git,
  openssl,
  libgcc,
  zstd,
  stdenv,
  darwin,
  filesets,
  autoPatchelfHook,
  version ? "dev",
}:
let
  sharedAttrs = {
    pname = "blocksense";
    inherit (filesets.rustSrc) src;

    nativeBuildInputs = [
      pkg-config
      git
      autoPatchelfHook
    ];

    buildInputs = [
      libusb
      openssl
      zstd
    ] ++ lib.optionals stdenv.isDarwin [ darwin.apple_sdk.frameworks.Security ];

    env = {
      ZSTD_SYS_USE_PKG_CONFIG = true;
    };

    doCheck = false;
    strictDeps = true;

    preBuild = ''
      addAutoPatchelfSearchPath ${libgcc.lib}/lib/
    '';
  };

  cargoArtifacts = craneLib.buildDepsOnly (sharedAttrs // { name = "blocksense-cargo-deps"; });
in
craneLib.buildPackage (sharedAttrs // { inherit version cargoArtifacts; })
