{ lib, ... }:
let
  root = ../.;
in
with lib.fileset;
{
  inherit (lib.fileset) trace;

  rustFilter =
    args:
    let
      src =
        (
          if (builtins.isString args || builtins.isPath args) then
            [ args ]
          else if builtins.isAttrs args then
            if builtins.isList args.src then args.src else [ args.src ]
          else if builtins.isList args then
            args
          else
            throw "src must be a string, path or list"
        )
        ++ [ ../.cargo ];

      additional =
        if builtins.isAttrs args then
          if builtins.hasAttr "additional" args then
            if builtins.isList args.additional then args.additional else [ args.additional ]
          else
            [ ]
        else
          [ ];

      fileset = unions (
        [
          (root + "/Cargo.toml")
          (root + "/Cargo.lock")
        ]
        ++ (builtins.concatMap (x: [
          (fileFilter (
            file:
            builtins.any file.hasExt [
              "rs"
              "toml"
              "wit"
              "lock"
              "json"
              "sol"
            ]
          ) x)
        ]) src)
        ++ additional
      );
    in
    toSource { inherit root fileset; };
}
