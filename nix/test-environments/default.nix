{ self, ... }:
{
  perSystem =
    {
      pkgs,
      config,
      lib,
      ...
    }:
    let
      allEnvironmentNames = lib.pipe (builtins.readDir ./.) [
        (lib.filterAttrs (
          name: value: (lib.hasSuffix ".nix" name) && name != "default.nix" && value == "regular"
        ))
        builtins.attrNames
        (builtins.map (name: lib.removeSuffix ".nix" name))
      ];

      allEnvironments = lib.pipe allEnvironmentNames [
        (builtins.map (name: {
          inherit name;
          value = config.devenv.shells.${name}.process.managers.process-compose.configFile;
        }))
      ];

      allProcessComposeFiles = pkgs.runCommand "allProcessComposeFiles" { } ''
        mkdir $out
        (
          set -x
          ${lib.concatMapStringsSep "\n" (
            x: "cp ${x.value} $out/${x.name}-process-compose.yaml"
          ) allEnvironments}
        )
      '';
    in
    {
      legacyPackages = {
        process-compose-environments = lib.listToAttrs allEnvironments;
      };

      packages = {
        inherit allProcessComposeFiles;
      };

      devenv.shells = lib.genAttrs allEnvironmentNames (name: {
        imports = [
          self.nixosModules.blocksense-process-compose
          ./${name}.nix
        ];
      });
    };
}
