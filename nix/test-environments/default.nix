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
        # example-setup-03 is faster than example-setup-01, so we use it as the default test environment.
        blocksense = pkgs.testers.runNixOSTest {
          name = "blocksense";
          enableOCR = true;
          nodes.machine = {
            imports = [
              self.nixosModules.blocksense-systemd
              ./test-setup.nix
              self.nixosModules.example-setup-vm
              {
                virtualisation.memorySize = 16 * 1024;
                virtualisation.cores = 4;
                networking.nameservers = [ "8.8.8.8" ];
                environment.systemPackages = [ pkgs.jq ];
                # environment.variables =
                #   builtins.readDir ./test-keys
                #   |> builtins.attrNames
                #   |> builtins.filter (x: x == lib.toUpper x)
                #   |> builtins.map (x: {
                #     name = x;
                #     value = "x";
                #   })
                #   |> builtins.listToAttrs;
              }
            ];
          };
          testScript = ''
            machine.start();

            # machine.copy_from_host("${./test-keys}", "./test-keys");

            # machine.wait_for_unit("network-online.target"); # network-online.target seems to no longer exist. Find an alternative. In the mean time it somehow works.
            machine.wait_for_unit("multi-user.target");

            # machine.wait_for_unit("blocksense-anvil-ethereum-sepolia.service");
            machine.wait_for_unit("blocksense-anvil-ink-sepolia.service");
            machine.wait_for_unit("blocksense-sequencer.service");
            machine.wait_for_unit("blocksense-reporter-a.service");

            # machine.succeed("ping 8.8.8.8 -c 1");

            # machine.wait_for_open_port(8546);
            machine.wait_for_open_port(8547);
            machine.wait_for_open_port(5553);


            machine.execute("sleep 10");
            runs = 0;
            while machine.execute("curl http://127.0.0.1:5553/get_history | jq '.aggregate_history | all(. == [])'")[1].strip() == "true":
              machine.execute("sleep 10");

              runs += 1;
              if runs > 60:
                machine.succeed("false");

            if machine.execute("curl http://127.0.0.1:5553/get_history | jq '.aggregate_history | all(. == [])'")[1].strip() == "false":
              machine.succeed("true");
            else:
              machine.succeed("false");

            # Using UpgradeableProxy contract: Reading last update for feed with id 0
            # machine.succeed("cast call 0xee5a4826068c5326a7f06fd6c7cbf816f096846c --data 0x80000000 --rpc-url http://127.0.0.1:8546 | cut -c1-50 | cast to-dec");
            #Using ChainlinkProxy contract:Reading the latest answer from a ChainlinkProxy contract
            # machine.succeed("cast call 0x9fAb38E38d526c6ba82879c6bDe1c4Fd73378f17 \"latestAnswer()\" --rpc-url http://127.0.0.1:8546 | cast to-dec");
            #Using UpgradeableProxyADFS contract: Reading the last update for feed with id 0
            machine.succeed("cast call 0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b --data 0x8200000000000000000000000000000000  --rpc-url http://127.0.0.1:8547 | cut -c1-50 | cast to-dec");
            #Using CLAggregatorAdapter contract: Reading the latest answer from a CLAggregatorAdapter contract
            machine.succeed("cast call 0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f \"latestAnswer()\" --rpc-url http://127.0.0.1:8547 | cast to-dec");


          '';
        };
      };
    };
}
