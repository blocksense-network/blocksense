{
  stdenv,
  pkgs,
  lib,
  offlineCache,
  missingHashes,
  yarn-berry,
  filterWorkspaces,
}:
{
  folders ? [ ],
  scripts ? [ "yarn build:all" ],
}:

stdenv.mkDerivation {
  pname =
    "yarn-workspace-"
    + (
      if (builtins.length folders) > 0 then
        (lib.concatMapStringsSep "-" (x: (builtins.baseNameOf x)) folders)
      else
        "base"
    );
  version = "unstable";

  src = filterWorkspaces folders;
  nativeBuildInputs = with pkgs; [
    yarn-berry
    yarn-berry.yarnBerryConfigHook
    python3
    pkg-config
    libusb1
    udev

  ];

  postPatch = ''
    yarn plugin remove @yarnpkg/plugin-nix-berry
  '';

  buildPhase = builtins.concatStringsSep "\n" scripts;

  installPhase = ''
    mkdir -p $out
    cp -r * .* $out/
  '';

  inherit offlineCache missingHashes;
}
