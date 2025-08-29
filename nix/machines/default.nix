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
    "aarch64-linux"
    "x86_64-darwin"
    "aarch64-darwin"
  ];
  allEnvironmentMachines = lib.foldl' (
    acc: path:
    let
      baseName = builtins.baseNameOf path;
      machinesForPath = lib.listToAttrs (
        lib.map (system: {
          name = if system == "x86_64-linux" then baseName else "${baseName}-${system}";
          value = testEnvironmentConfig path system;
        }) systems
      );
    in
    acc // machinesForPath
  ) { } allEnvironmentPaths;

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
  flake.nixosModules.example-setup-vm = {
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
    environment.defaultPackages = [ self.legacyPackages.x86_64-linux.foundry ];
  };
  flake.nixosConfigurations = { } // allEnvironmentMachines;
}
