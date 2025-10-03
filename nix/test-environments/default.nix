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
      self',
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
      packages = {
        inherit (self'.legacyPackages.process-compose-environments.with-local-cargo-artifacts) all;
      };

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
                virtualisation = {
                  memorySize = 16 * 1024;
                  cores = 4;
                  forwardPorts = [
                    {
                      from = "host";
                      host.port = 2000;
                      guest.port = 22;
                    }
                  ];
                };

                services.openssh = {
                  enable = true;
                  settings = {
                    PermitRootLogin = "yes";
                    PermitEmptyPasswords = "yes";
                  };
                };

                security.pam.services.sshd.allowNullPassword = true;
                networking.nameservers = [ "8.8.8.8" ];
              }
            ];
          };
          testScript = builtins.readFile (
            lib.replaceVars ./test-script.py {
              jq = "${pkgs.jq}/bin/jq";
              cast = "${pkgs.foundry}/bin/cast";

              BASE_URL = "http://127.0.0.1";
              INK_PORT = config.services.blocksense.anvil.ink-sepolia.port; # 8547
              SEPOLIA_PORT = config.services.blocksense.anvil.ethereum-sepolia.port; # 8546
              SEQUENCER_PORT = config.services.blocksense.sequencer.ports.main; # 9856
              SEQUENCER_ADMIN_PORT = config.services.blocksense.sequencer.ports.admin; # 5553
              SEQUENCER_METRICS_PORT = config.services.blocksense.sequencer.ports.metrics; # 5551

              # Contract Addresses
              UPGRADEABLE_PROXY_CONTRACT = "0xee5a4826068c5326a7f06fd6c7cbf816f096846c";
              CHAINLINK_PROXY_CONTRACT = "0x9fAb38E38d526c6ba82879c6bDe1c4Fd73378f17";
              UPGRADEABLE_PROXY_ADFS_CONTRACT = "0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b";
              CL_AGGREGATOR_ADAPTER_CONTRACT = "0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f";

              # Service Names
              REPORTER_SERVICE = "blocksense-reporter-a.service";
              ANVIL_SEPOLIA_SERVICE = "blocksense-anvil-ethereum-sepolia.service";
              ANVIL_INK_SERVICE = "blocksense-anvil-ink-sepolia.service";
              SEQUENCER_SERVICE = "blocksense-sequencer.service";

              # Timeouts
              ENDPOINT_EXISTENCE_TIMEOUT = 900;
              HISTORY_POPULATION_TIMEOUT = 360;
              NETWORK_UPDATE_TIMEOUT = 180;
              VALUE_CHANGE_TIMEOUT = 20;
              VALUE_CHANGE_POLL_INTERVAL = 1;
            }
          );
        };
      };
    };
}
