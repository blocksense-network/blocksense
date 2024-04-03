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
    flake-parts.follows = "mcl-blockchain/flake-parts";
    fenix.follows = "mcl-blockchain/fenix";
  };

  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      imports = [./nix];
      systems = ["x86_64-linux" "aarch64-darwin"];
    };
}
