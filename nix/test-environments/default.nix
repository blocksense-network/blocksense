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

      # You can run the test with the following command:
      # `nix run .#checks.x86_64-linux.example-setup-01.driver --impure`
      checks = lib.genAttrs allEnvironmentNames (
        name:
        pkgs.testers.runNixOSTest {
          name = "sequencer-test";

          nodes.machine = {
            options.devenv.root = lib.mkOption {
              type = lib.types.path;
              default = builtins.getEnv "PWD";
            };
            config = {
              virtualisation = {
                graphics = false;
                cores = 8;
                memorySize = 16384;
                diskSize = 4096;
              };
            };

            imports = [
              self.nixosModules.blocksense-systemd

              ./${name}.nix
            ];
          };

          testScript = ''
            machine.wait_for_unit("default.target")
            freeRam = machine.execute("free -h")
            systemdAnvil = machine.execute("cat /etc/systemd/system/blocksense-anvil-a.service")
            systemdSequencer = machine.execute("cat /etc/systemd/system/blocksense-sequencer.service")
            systemdReporter = machine.execute("cat /etc/systemd/system/blocksense-reporter-a.service")

            print(freeRam)
            print(systemdAnvil)
            print(systemdSequencer)
            print(systemdReporter)
          '';
        }
      );
    };
}
