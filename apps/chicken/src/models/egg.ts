import { Schema } from '@effect/schema';

// Egg supply model
export class EggSupply extends Schema.Class<EggSupply>('EggSupply')({
  id: Schema.String,
  quantity: Schema.Number,
  updatedAt: Schema.Date,
}) {}

// Egg price model
export class EggPrice extends Schema.Class<EggPrice>('EggPrice')({
  id: Schema.String,
  price: Schema.Number,
  updatedAt: Schema.Date,
}) {}

// Request schemas for API
export const SetSupplyRequest = Schema.Struct({
  quantity: Schema.Number,
});

export const SetPriceRequest = Schema.Struct({
  price: Schema.Number,
});
