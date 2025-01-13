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

To learn more, see [the root readme](/README.md), section "Supported deployment options".
