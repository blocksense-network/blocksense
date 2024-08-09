{
  lib,
  craneLib,
  pkg-config,
  libusb,
  openssl,
  zstd,
  stdenv,
  darwin,
  filesets,
  git,
}: let
  sharedAttrs = {
    pname = "blocksense";
    version = "alpha";
    inherit (filesets.rustSrc) src;

    nativeBuildInputs = [pkg-config git];

    buildInputs =
      [
        libusb
        openssl
        zstd
      ]
      ++ lib.optionals stdenv.isDarwin [darwin.apple_sdk.frameworks.Security];

    env = {
      ZSTD_SYS_USE_PKG_CONFIG = true;
    };

    doCheck = false;
    strictDeps = true;
  };

  cargoArtifacts = craneLib.buildDepsOnly sharedAttrs;
in
  craneLib.buildPackage (sharedAttrs // {inherit cargoArtifacts;})
# craneLib.buildPackage sharedAttrs

