#!/usr/bin/env node

import * as Effect from 'effect/Effect';
import * as NodeContext from '@effect/platform-node/NodeContext';
import * as NodeRuntime from '@effect/platform-node/NodeRuntime';

import { run } from './Cli.js';

run(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain({ disableErrorReporting: false }),
);
