import { Context, Layer } from 'effect';
import { HttpApiBuilder, HttpServer } from '@effect/platform';

import { EnvTag, VerifyApiLive } from './endpoints';

export default {
  async fetch(request, env): Promise<Response> {
    const { handler } = HttpApiBuilder.toWebHandler(
      Layer.mergeAll(VerifyApiLive, HttpServer.layerContext) as any,
    );

    return handler(
      request as unknown as Request,
      Context.empty().pipe(Context.add(EnvTag as any, env)),
    );
  },
} satisfies ExportedHandler<Env>;
