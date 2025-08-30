import { Effect, Ref, Context, Layer } from 'effect';
import type { EggSupply, EggPrice } from '../models/egg.js';

// Database service interface
export interface DatabaseService {
  readonly getSupply: Effect.Effect<EggSupply | null>;
  readonly setSupply: (quantity: number) => Effect.Effect<EggSupply>;
  readonly getPrice: Effect.Effect<EggPrice | null>;
  readonly setPrice: (price: number) => Effect.Effect<EggPrice>;
}

// Create a service tag
export class Database extends Context.Tag('Database')<
  Database,
  DatabaseService
>() {}

// Create a live implementation of the database
export const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const supplyRef = yield* Ref.make<EggSupply | null>(null);
    const priceRef = yield* Ref.make<EggPrice | null>(null);

    return {
      getSupply: Ref.get(supplyRef),

      setSupply: (quantity: number) =>
        Effect.gen(function* () {
          const supply: EggSupply = {
            id: crypto.randomUUID(),
            quantity,
            updatedAt: new Date(),
          };
          yield* Ref.set(supplyRef, supply);
          return supply;
        }),

      getPrice: Ref.get(priceRef),

      setPrice: (price: number) =>
        Effect.gen(function* () {
          const priceData: EggPrice = {
            id: crypto.randomUUID(),
            price,
            updatedAt: new Date(),
          };
          yield* Ref.set(priceRef, priceData);
          return priceData;
        }),
    } satisfies DatabaseService;
  }),
);
