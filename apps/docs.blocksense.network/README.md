# Blocksense Network Documentation Site

## Dev guide

### Available Scripts

In the project directory, you can run the following yarn commands:

#### `yarn build:tsc`

Compiles TypeScript files using the configuration from `tsconfig.lib.json`.

```sh
yarn build:tsc
```

#### `yarn build:deps`

Build the dependencies for the project that live in our workspace. Currently we have `@blocksense/docs-theme` as dependency, package that contains the theme for the documentation site.

```sh
yarn build:deps
```

#### `yarn build`

Builds the project.

```sh
yarn build
```

#### `yarn start`

Runs the project in production mode. The application should be compiled first.

```sh
yarn start
```

#### `yarn dev`

Runs the project in development mode with hot-code reloading, error reporting, and more.

```sh
yarn dev
```

#### `yarn ready-dev-go`

Runs the project in development mode with hot-code reloading, error reporting, and more. This command is used to start the project in development mode with all the necessary dependencies built.

```sh
yarn ready-dev-go
```

#### `yarn test`

Runs tests.

```sh
yarn test
```

### Available Deployments

Supported deployments can be found under blocksense/nix/test-environments

#### systemd deployment

In order to perform a systemd deployment one needs to:

1. Add as flake input `github:blocksense-network/blocksense`
2. In the configuration of the machine, where the blocksense micro services will be deployed, the blocksense NixOS module must be imported:

```
imports = [
   inputs.blocksense.nixosModules.blocksense-systemd
];
```

3. To configure the sequencer, the reporters and the anvil nodes one can use the [setup1.nix](/nix/test-environments/setup1.nix) file.

#### process-compose deployment

First, make sure you have a `process-compose.yaml` file that can be generated
by executing command:

```sh
direnv reload
```

the contents of `process-compose.yaml` are populated from the file
`nix/test-environments/example-setup-01.nix`. To change the setup (add more
reporters, change the feeds list etc) edit `example-setup-01.nix` and then run
`direnv reload` again.

The example setup is with 1 instance of the sequencer, 2 anvil nodes is
supported.

To perform this deployment, we need to run:

```sh
process-compose up
```
