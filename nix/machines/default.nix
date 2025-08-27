{
  self,
  lib,
  ...
}:
let
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
  flake.nixosConfigurations = {
    example-setup-01 = testEnvironmentConfig ../test-environments/example-setup-01.nix "x86_64-linux";
    # example-setup-02 = testEnvironmentConfig ../test-environments/example-setup-02.nix "x86_64-linux"; #services.kafka doesn't exist
  };
}
