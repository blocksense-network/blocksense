{
  pkgs,
  self',
  ...
}: {
  packages =
    [
      self'.legacyPackages.rustToolchain
    ]
    ++ (with pkgs; [
      openssl
      pkg-config
      cargo-tarpaulin
    ]);
}
