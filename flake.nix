{
  description = "Blocksense Network Monorepo";

  nixConfig = {
    extra-substituters = [
      "https://blocksense.cachix.org"
      "https://mcl-blockchain-packages.cachix.org"
    ];
    extra-trusted-public-keys = [
      "blocksense.cachix.org-1:BGg+LtKwTRIBw3BxCWEV//IO7v6+5CiJVSGzBOQUY/4="
      "mcl-blockchain-packages.cachix.org-1:qoEiUyBgNXmgJTThjbjO//XA9/6tCmx/OohHHt9hWVY="
    ];
  };

  inputs = {
    mcl-blockchain.url = "github:metacraft-labs/nix-blockchain-development";
    nixpkgs.follows = "mcl-blockchain/nixpkgs";
    nixpkgs-unstable.follows = "mcl-blockchain/nixpkgs-unstable";
    ethereum-nix.follows = "mcl-blockchain/nixos-modules/ethereum-nix";
    flake-parts.follows = "mcl-blockchain/flake-parts";
    fenix.follows = "mcl-blockchain/fenix";
    devenv.follows = "mcl-blockchain/devenv";
    nix2container.follows = "mcl-blockchain/nix2container";
    mk-shell-bin.url = "github:rrbutani/nix-mk-shell-bin";
  };

  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      imports = [
        # Third-party flake-parts modules
        inputs.devenv.flakeModule

        # Local flake-parts modules
        ./nix
      ];
      systems = ["x86_64-linux" "aarch64-darwin"];
    };
}
