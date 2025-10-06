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
      debugEnvironments =
        let
          basePath = lib.path.append ./../.. "nix/test-environments";
        in
        lib.pipe basePath
          [
            builtins.readDir
            (lib.filterAttrs (
              name: value: (lib.hasSuffix ".nix" name) && name != "default.nix" && value == "regular"
            ))
            builtins.attrNames
            (builtins.map (name: {
              name = lib.removeSuffix ".nix" name;
              path = lib.path.append basePath name;
            }))
          ];

      e2eEnvironements =
        let
          basePath = lib.path.append ./../.. "apps/e2e-tests/src/test-scenarios";
        in
        lib.pipe basePath
          [
            builtins.readDir
            (lib.filterAttrs (name: value: value == "directory"))
            builtins.attrNames
            (builtins.map (name: {
              name = "e2e-${name}";
              path = lib.path.append basePath "${name}/environment-setup.nix";
            }))
          ];

      allEnvironments = debugEnvironments ++ e2eEnvironements;

      getShellName =
        name: use-local-cargo-result:
        if use-local-cargo-result then "${name}-use-local-cargo-result" else name;

      generateAllEnvironments =
        { local }:
        lib.pipe allEnvironments [
          (builtins.map ({ name, path }: {
            inherit name;
            value =
              let
                shell-name = getShellName name local;
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
        { local }:
        pkgs.runCommand "allProcessComposeFiles" { } ''
          mkdir "$out"
          (
            set -x
            ${lib.concatMapStringsSep "\n" (x: "cp -r ${x.value} \"$out/${x.name}\"") (generateAllEnvironments {
              inherit local;
            })}
          )
        '';
    in
    {
      legacyPackages = {
        process-compose-environments = {
          hermetic =
            (lib.listToAttrs (generateAllEnvironments {
              local = false;
            }))
            // {
              all = allProcessComposeFiles { local = false; };
            };
          with-local-cargo-artifacts =
            (lib.listToAttrs (generateAllEnvironments {
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
            environement = allEnvironments;
            local = [
              false
              true
            ];
          };
        in
        lib.pipe shellCombinations [
          (builtins.map (
            { environement, local }:
            lib.nameValuePair (getShellName environement.name local) {
              imports = [
                self.nixosModules.blocksense-process-compose
                environement.path
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
