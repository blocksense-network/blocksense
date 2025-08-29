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
      allEnvironmentNames =
        lib.pipe (builtins.readDir (lib.path.append ./../.. "nix/test-environments"))
          [
            (lib.filterAttrs (
              name: value: (lib.hasSuffix ".nix" name) && name != "default.nix" && value == "regular"
            ))
            builtins.attrNames
            (builtins.map (name: lib.removeSuffix ".nix" name))
          ];

      getShellName =
        name: use-local-cargo-result:
        if use-local-cargo-result then "${name}-use-local-cargo-result" else name;

      allEnvironments =
        { local }:
        lib.pipe allEnvironmentNames [
          (builtins.map (name: {
            inherit name;
            value =
              let
                shell-name = getShellName name local;
              in
              pkgs.runCommandNoCCLocal "process-compose-${name}" { } ''
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
        { local }:
        pkgs.runCommandNoCCLocal "allProcessComposeFiles" { } ''
          mkdir "$out"
          (
            set -x
            ${lib.concatMapStringsSep "\n" (x: "cp -r ${x.value} \"$out/${x.name}\"") (allEnvironments {
              inherit local;
            })}
          )
        '';
    in
    {
      legacyPackages = {
        process-compose-environments = {
          hermetic =
            (lib.listToAttrs (allEnvironments {
              local = false;
            }))
            // {
              all = allProcessComposeFiles { local = false; };
            };
          with-local-cargo-artifacts =
            (lib.listToAttrs (allEnvironments {
              local = true;
            }))
            // {
              all = allProcessComposeFiles { local = true; };
            };
        };

      };

      devenv.shells =
        let
          shellCombinations = lib.cartesianProduct {
            name = allEnvironmentNames;
            local = [
              false
              true
            ];
          };
        in
        lib.pipe shellCombinations [
          (builtins.map (
            { name, local }:
            lib.nameValuePair (getShellName name local) {
              imports = [
                self.nixosModules.blocksense-process-compose
                ./${name}.nix
                {
                  services.blocksense.process-compose.use-local-cargo-result = local;
                }
              ];
            }
          ))
          lib.listToAttrs
        ];
    };
}
