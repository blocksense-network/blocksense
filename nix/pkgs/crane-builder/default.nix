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

    # This is necessary, as 'cargo build' WILL fail if any of the members' files are not present
    # in the source tree. This is a workaround to avoid having to include all of them in the
    # fileset.
    preConfigure = ''
      ${perl}/bin/perl -0777 -pi -e 's|members = \[.*?\]|members = [ "${
        builtins.replaceStrings [ "/" ] [ "\/" ] (lib.concatStringsSep "\",\\n\"" memberList)
      }" ]|s' Cargo.toml
    '';
  }
)
