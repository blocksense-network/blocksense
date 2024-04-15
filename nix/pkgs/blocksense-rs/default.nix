{
  lib,
  rustPlatform,
  pkg-config,
  libusb,
  openssl,
  zstd,
  stdenv,
  darwin,
  filesets,
}:
rustPlatform.buildRustPackage rec {
  pname = "blocksense";
  version = "alpha";
  src = filesets.rustSrc.src;

  cargoLock = {
    lockFile = "${src}/Cargo.lock";
    outputHashes = {
      "alloy-0.1.0" = "sha256-EfAVOlseCweeDYwX5iy+K3DUJNQXUmUbIFSRfWAYBqk=";
    };
  };
  nativeBuildInputs = [
    pkg-config
  ];
  buildInputs =
    [
      libusb
      openssl
      zstd
    ]
    ++ lib.optionals stdenv.isDarwin [
      darwin.apple_sdk.frameworks.Security
    ];
  env = {
    ZSTD_SYS_USE_PKG_CONFIG = true;
  };
}
