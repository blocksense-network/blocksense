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

      allEnvironments =
        use-local-cargo-result:
        lib.pipe allEnvironmentNames [
          (builtins.map (name: {
            inherit name;
            value =
              let
                shell-name = if use-local-cargo-result then "${name}-use-local-cargo-result" else name;
              in
              pkgs.runCommand "process-compose-${name}" { } ''
                mkdir -p "$out"
                ln -s ${
                  config.devenv.shells.${shell-name}.process.managers.process-compose.configFile
                } "$out/process-compose.yaml"

                for file in ${config.devenv.shells.${shell-name}.services.blocksense.config-dir}/*; do
                  ln -s "$file" "$out/$(basename $file)"
                done
              '';
          }))
        ];

      allProcessComposeFiles =
        use-local-cargo-result:
        pkgs.runCommand "allProcessComposeFiles" { } ''
          mkdir "$out"
          (
            set -x
            ${lib.concatMapStringsSep "\n" (x: "cp -r ${x.value} \"$out/${x.name}\"") (
              allEnvironments use-local-cargo-result
            )}
          )
        '';
    in
    {
      legacyPackages = {
        process-compose-environments = lib.listToAttrs (allEnvironments false);
        process-compose-environments-with-cargo-local = lib.listToAttrs (allEnvironments true);
      };

      packages = {
        allProcessComposeFiles = allProcessComposeFiles false;
        allProcessComposeFilesWithLocalCargoResult = allProcessComposeFiles true;
      };

      devenv.shells =
        let
          shellCombinations =
            allEnvironmentNames ++ (builtins.map (name: "${name}-use-local-cargo-result") allEnvironmentNames);
        in
        lib.genAttrs shellCombinations (name: {
          imports = [
            self.nixosModules.blocksense-process-compose
            ./${lib.removeSuffix "-use-local-cargo-result" name}.nix
            {
              services.blocksense.process-compose.use-local-cargo-result = lib.hasSuffix "-use-local-cargo-result" name;
            }
          ];
        });
    };
}
