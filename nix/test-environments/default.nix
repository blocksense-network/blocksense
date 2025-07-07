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
          value = pkgs.runCommand "process-compose-${name}" { } ''
            mkdir -p "$out"
            ln -s ${
              config.devenv.shells.${name}.process.managers.process-compose.configFile
            } "$out/process-compose.yaml"

            for file in ${config.devenv.shells.${name}.services.blocksense.config-dir}/*; do
              ln -s "$file" "$out/$(basename $file)"
            done
          '';
        }))
      ];

      allProcessComposeFiles = pkgs.runCommand "allProcessComposeFiles" { } ''
        mkdir "$out"
        (
          set -x
          ${lib.concatMapStringsSep "\n" (x: "cp -r ${x.value} \"$out/${x.name}\"") allEnvironments}
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
