{ lib, ... }:
let
  root = ../.;
in
with lib.fileset;
{
  inherit (lib.fileset) trace;

  rustSrc = rec {
    fileset = unions [
      (root + "/Cargo.toml")
      (root + "/Cargo.lock")

      (fileFilter (
        file:
        builtins.any file.hasExt [
          "rs"
          "toml"
          "wit"
          "json"
          "sol"
        ]
      ) root)

    ];
    src = toSource { inherit root fileset; };
  };
}
