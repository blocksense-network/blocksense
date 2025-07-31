{
  description = "Blocksense Network Monorepo";

  nixConfig = {
    extra-substituters = [
      "https://cache.metacraft-labs.com/blocksense-public"
      "https://cache.metacraft-labs.com/metacraft-public"
    ];
    extra-trusted-public-keys = [
      "blocksense-public:OOgTc0ye1FONCiVHMrbpScc/HP+lX3uoU0EfwzX6ypE="
      "metacraft-public:UtS6PK+p0uZaJK3i/jD2DQOjTpddhQUQmNQDQih5N4Q="
    ];
  };

  inputs = {
    mcl-blockchain.url = "github:metacraft-labs/nix-blockchain-development";
    nixpkgs.follows = "mcl-blockchain/nixpkgs";
    nixpkgs-unstable.follows = "mcl-blockchain/nixpkgs-unstable";
    mcl-nixos-modules.follows = "mcl-blockchain/nixos-modules";
    ethereum-nix.follows = "mcl-blockchain/nixos-modules/ethereum-nix";
    flake-parts.follows = "mcl-blockchain/flake-parts";
    fenix.follows = "mcl-blockchain/fenix";
    devenv.follows = "mcl-blockchain/devenv";
    # HACK: <https://github.com/cachix/devenv/issues/1764>
    devenv-root = {
      url = "file+file:///dev/null";
      flake = false;
    };
    nix2container.follows = "mcl-blockchain/nix2container";
    mk-shell-bin.url = "github:rrbutani/nix-mk-shell-bin";
    blama = {
      url = "github:blocksense-network/blama";
      flake = false;
    };
    quartz-nix = {
      url = "github:blocksense-network/nix-quartz";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "mcl-blockchain/flake-utils";
    };
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } (
      { lib, ... }:
      {
        imports = [
          # Third-party flake-parts modules
          inputs.devenv.flakeModules.default

          # Local flake-parts modules
          (lib.path.append ./. "nix")
        ];
        systems = [
          "x86_64-linux"
          "aarch64-darwin"
        ];
      }
    );
}
