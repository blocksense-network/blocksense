{
  self,
  lib,
  ...
}:
let
  testEnvironmentConfig =
    conf:
    lib.nixosSystem {
      modules = [
        {
          imports = [
            self.nixosModules.blocksense-systemd
            conf
            self.nixosModules.example-setup-vm
            {
              nixpkgs.hostPlatform = {
                system = "x86_64-linux";
              };
              boot.loader = {
                systemd-boot.enable = true;
                efi.canTouchEfiVariables = true;
                grub.devices = [ "nodev" ];
              };
              fileSystems."/" = {
                device = "/dev/sda1234";
                fsType = "ext4";
              };
            }
          ];
        }
      ];
    };

in
{
  flake.nixosModules.example-setup-vm = {
    nix.settings.sandbox = false;
    networking.useHostResolvConf = true;
    systemd.services.network-online.enable = true;
    systemd.targets.network-online.wantedBy = lib.mkForce [ "mult-user.target" ];
    environment.defaultPackages = [ self.legacyPackages.x86_64-linux.foundry ];
  };
  flake.nixosConfigurations = {
    example-setup-01 = testEnvironmentConfig ../test-environments/example-setup-01.nix;
    # example-setup-02 = testEnvironmentConfig ../test-environments/example-setup-02.nix; #services.kafka doesn't exist
  };
}
