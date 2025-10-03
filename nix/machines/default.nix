{
  self,
  lib,
  ...
}:
let
  allEnvironmentPaths = lib.filter (path: lib.hasPrefix "example-setup-" (builtins.baseNameOf path)) (
    lib.attrValues (builtins.readDir ../test-environments)
  );

  systems = [
    "x86_64-linux"
  ];

  allEnvironmentMachines = lib.listToAttrs (
    lib.concatMap (
      path:
      let
        baseName = builtins.baseNameOf path;
      in
      lib.map (system: {
        name = "${baseName}-${system}";
        value = testEnvironmentConfig path system;
      }) systems
    ) allEnvironmentPaths
  );

  testEnvironmentConfig =
    conf: system:
    lib.nixosSystem {
      modules = [
        self.nixosModules.blocksense-systemd
        conf
        self.nixosModules.example-setup-vm
        {
          nixpkgs.hostPlatform = {
            inherit system;
          };
        }
      ];
    };

in
{
  # NixOS module for the VM used in the example setup environments
  flake.nixosModules.example-setup-vm =
    { ... }:
    {
      boot.loader = {
        systemd-boot.enable = true;
        efi.canTouchEfiVariables = true;
        grub.devices = [ "nodev" ];
      };
      fileSystems."/" = {
        device = "/dev/sda1234";
        fsType = "ext4";
      };
      nix.settings.sandbox = false;
      networking.useNetworkd = true;
      systemd = {
        network.enable = true;
        network.wait-online.enable = false;
        services.network-online.enable = true;
      };
    };
  flake.nixosConfigurations = allEnvironmentMachines;
}
