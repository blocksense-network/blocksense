{
  self,
  lib,
  ...
}:
{
  perSystem =
    {
      pkgs,
      config,
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
            ./modules/process-compose.nix
          ];
        });

      legacyPackages.nixosTests = {
        example-setup-01 = pkgs.testers.runNixOSTest {
          name = "example-setup-01";
          nodes.machine = {
            imports = [
              self.nixosModules.blocksense-systemd
              ./example-setup-01.nix
              self.nixosModules.example-setup-vm
            ];
          };
          testScript = ''
            machine.start();
            machine.wait_for_unit("blocksense-sequencer.service");
            machine.wait_for_unit("blocksense-reporter-a.service");
            machine.wait_for_unit("blocksense-anvil-ethereum-sepolia.service");
            machine.wait_for_unit("blocksense-anvil-ink-sepolia.service");
          '';
        };
      };
    };
}
