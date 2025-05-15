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
          ${lib.concatMapStringsSep "\n" (
            x: "cp ${x.file} $out/${x.name}-process-compose.yaml"
          ) allEnvironments}
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
              {
                virtualisation.memorySize = 16 * 1024;
                virtualisation.cores = 4;
                networking.nameservers = [ "8.8.8.8" ];
              }
            ];
          };
          testScript = ''
            machine.start();
            machine.wait_for_unit("network-online.target");

            machine.wait_for_unit("blocksense-anvil-ethereum-sepolia.service");
            machine.wait_for_unit("blocksense-anvil-ink-sepolia.service");
            machine.wait_for_unit("blocksense-sequencer.service");
            machine.wait_for_unit("blocksense-reporter-a.service");

            machine.wait_for_open_port(8546);
            machine.wait_for_open_port(8547);
            machine.wait_for_open_port(5553);

            # Using UpgradeableProxy contract: Reading last update for feed with id 0
            machine.succeed("cast call 0xee5a4826068c5326a7f06fd6c7cbf816f096846c --data 0x80000000 --rpc-url http://127.0.0.1:8546 | cut -c1-50 | cast to-dec");
            #Using ChainlinkProxy contract:Reading the latest answer from a ChainlinkProxy contract
            machine.succeed("cast call 0x9fAb38E38d526c6ba82879c6bDe1c4Fd73378f17 \"latestAnswer()\" --rpc-url http://127.0.0.1:8546 | cast to-dec");
            #Using UpgradeableProxyADFS contract: Reading the last update for feed with id 0
            machine.succeed("cast call 0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b --data 0x8200000000000000000000000000000000  --rpc-url http://127.0.0.1:8547 | cut -c1-50 | cast to-dec");
            #Using CLAggregatorAdapter contract: Reading the latest answer from a CLAggregatorAdapter contract
            machine.succeed("cast call 0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f \"latestAnswer()\" --rpc-url http://127.0.0.1:8547 | cast to-dec");
          '';
        };
      };
    };
}
