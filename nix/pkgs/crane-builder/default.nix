{
  lib,
  craneLib,
  perl,
  filesets,
  cargoArtifacts,
}:
{
  members,
  additional ? [ ],
  pname ? "blocksense",
  packageName ? pname,
  version ? "dev",
  extraArgs ? "",
  trueCargoArtifacts ? cargoArtifacts,
  isOracleScript ? false,
}:
let
  memberList = if builtins.isList members then members else [ members ];
in
craneLib.buildPackage (
  trueCargoArtifacts.sharedAttrs
  // {
    inherit version pname;
    cargoArtifacts = trueCargoArtifacts;
    cargoExtraArgs =
      extraArgs + (lib.optionalString isOracleScript "--target wasm32-wasip1") + " -p " + packageName;
    src = filesets.rustFilter {
      src = builtins.map (x: ../../.. + "/${x}") memberList;
      inherit additional;
    };
    preConfigure = ''
      ${perl}/bin/perl -0777 -pi -e 's|members = \[.*?\]|members = [ "${
        builtins.replaceStrings [ "/" ] [ "\/" ] (lib.concatStringsSep "\",\\n\"" memberList)
      }" ]|s' Cargo.toml
    '';
  }
)
