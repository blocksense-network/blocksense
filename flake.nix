{
  description = "Blocksense Network Monorepo";

  nixConfig = {
    extra-substituters = [
      "https://blocksense.cachix.org"
      "https://mcl-blockchain-packages.cachix.org"
      "https://mcl-public-cache.cachix.org"
    ];
    extra-trusted-public-keys = [
      "blocksense.cachix.org-1:BGg+LtKwTRIBw3BxCWEV//IO7v6+5CiJVSGzBOQUY/4="
      "mcl-blockchain-packages.cachix.org-1:qoEiUyBgNXmgJTThjbjO//XA9/6tCmx/OohHHt9hWVY="
      "mcl-public-cache.cachix.org-1:OcUzMeoSAwNEd3YCaEbNjLV5/Gd+U5VFxdN2WGHfpCI="
    ];
  };

  inputs = {
    mcl-nixos-modules.url = "github:metacraft-labs/nixos-modules/feat/nix-blockchain-development-migration";
    nixpkgs.follows = "mcl-nixos-modules/nixpkgs";
    nixpkgs-unstable.follows = "mcl-nixos-modules/nixpkgs-unstable";
    ethereum-nix.follows = "mcl-nixos-modules/ethereum-nix";
    flake-parts.follows = "mcl-nixos-modules/flake-parts";
    fenix.follows = "mcl-nixos-modules/fenix";
    devenv.follows = "mcl-nixos-modules/devenv";
    nix2container.follows = "mcl-nixos-modules/nix2container";
    mk-shell-bin.url = "github:rrbutani/nix-mk-shell-bin";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        # Third-party flake-parts modules
        inputs.devenv.flakeModule

        # Local flake-parts modules
        ./nix
      ];
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];
    };
}
