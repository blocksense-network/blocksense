{
  self,
  lib,
  inputs,
  ...
}:
{
  flake.nixosConfigurations =
    let
      pkgs = inputs.nixpkgs.legacyPackages.x86_64-linux;
    in
    {
      test-vm = pkgs.testers.runNixOSTest {
        name = "systemd-test";
        nodes.machine1 =
          { ... }:
          {
            imports = [
              # self.nixosModules.blocksense-systemd
              # ./example-setup-01.nix
            ];

            options = {
              devenv.root = lib.mkOption {
                type = lib.types.path;
                default = /home/petar/code/repos/metacraft-labs/blocksense;
              };
            };

            config = {
              users.users.toshko = {
                isNormalUser = true;
              };
            };
          };

        testScript =
          { nodes, ... }:
          ''
            machine.wait_for_unit("default.target")
          '';
      };
    };

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
          file = config.devenv.shells.${name}.process.managers.process-compose.configFile;
        }))
      ];

      runEnvironments = lib.pipe allEnvironments [
        (builtins.map (x: {
          name = "run-${x.name}";
          value = pkgs.writeShellScriptBin "run-${x.name}" ''
            ${lib.getExe pkgs.process-compose} -f ${x.file}
          '';
        }))
        lib.listToAttrs
      ];

      allProcessComposeFiles = pkgs.runCommand "allProcessComposeFiles" { } ''
        mkdir $out
        (
          set -x
          ${
            lib.concatMapStringsSep "\n" (x: "cp ${x.file} $out/${x.name}-process-compose.yaml") allEnvironments
          }
        )
      '';
    in
    {
      packages = {
        inherit allProcessComposeFiles;
      } // runEnvironments;

      devenv.shells =
        {
          default.packages = builtins.attrValues runEnvironments;
        }
        // lib.genAttrs allEnvironmentNames (name: {
          imports = [
            self.nixosModules.blocksense-process-compose
            ./${name}.nix
          ];
        });
    };
}
