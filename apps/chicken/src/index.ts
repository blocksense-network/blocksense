import { Effect, Ref, Context, Layer, Schema as S } from 'effect';
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpServer,
} from '@effect/platform';

// Global state storage (persists during worker lifetime)
declare global {
  var CHICKEN_SUPPLY_STATE: EggSupply | null;
  var CHICKEN_PRICE_STATE: EggPrice | null;
}

// Initialize global state if not exists
if (typeof globalThis.CHICKEN_SUPPLY_STATE === 'undefined') {
  globalThis.CHICKEN_SUPPLY_STATE = null;
}
if (typeof globalThis.CHICKEN_PRICE_STATE === 'undefined') {
  globalThis.CHICKEN_PRICE_STATE = null;
}

// Schemas
const EggSupplySchema = S.Struct({
  id: S.String,
  quantity: S.Number,
  updatedAt: S.Date,
});

const EggPriceSchema = S.Struct({
  id: S.String,
  price: S.Number,
  updatedAt: S.Date,
});

const SetSupplySchema = S.Struct({
  quantity: S.Number.pipe(S.greaterThanOrEqualTo(0)),
});

const SetPriceSchema = S.Struct({
  price: S.Number.pipe(S.greaterThanOrEqualTo(0)),
});

type EggSupply = S.Schema.Type<typeof EggSupplySchema>;
type EggPrice = S.Schema.Type<typeof EggPriceSchema>;

// HTML Content
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Egg Management System with Effect-TS</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      text-align: center;
      margin-bottom: 30px;
    }
    .tech-badge {
      display: inline-block;
      background: linear-gradient(45deg, #007bff, #0056b3);
      color: white;
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 20px;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background-color: #fafafa;
    }
    .form-group h3 {
      margin-top: 0;
      color: #555;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
      color: #666;
    }
    input[type="number"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 16px;
      box-sizing: border-box;
    }
    button {
      background-color: #007bff;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 10px;
    }
    button:hover {
      background-color: #0056b3;
    }
    .status {
      margin-top: 20px;
      padding: 15px;
      border-radius: 5px;
      background-color: #e8f5e8;
      border: 1px solid #c3e6c3;
      display: none;
    }
    .status h3 {
      margin-top: 0;
      color: #2d5a2d;
    }
    .current-values {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    .value-card {
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #dee2e6;
      text-align: center;
    }
    .value-card h4 {
      margin: 0 0 10px 0;
      color: #495057;
    }
    .value-number {
      font-size: 24px;
      font-weight: bold;
      color: #007bff;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🥚 Egg Management System</h1>
    <div style="text-align: center;">
      <span class="tech-badge">⚡ Powered by Effect-TS & Cloudflare Workers</span>
    </div>

    <div class="current-values">
      <div class="value-card">
        <h4>Current Supply</h4>
        <div class="value-number" id="currentSupply">-</div>
      </div>
      <div class="value-card">
        <h4>Current Price</h4>
        <div class="value-number" id="currentPrice">-</div>
      </div>
    </div>

    <div class="form-group">
      <h3>Set Egg Supply</h3>
      <label for="supply">Quantity:</label>
      <input type="number" id="supply" min="0" step="1" placeholder="Enter egg quantity">
      <button onclick="setSupply()">Update Supply</button>
    </div>

    <div class="form-group">
      <h3>Set Egg Price</h3>
      <label for="price">Price ($):</label>
      <input type="number" id="price" min="0" step="0.01" placeholder="Enter price per egg">
      <button onclick="setPrice()">Update Price</button>
    </div>

    <div class="status" id="status">
      <h3>Status</h3>
      <p id="statusMessage"></p>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      loadCurrentValues();
    });

    async function loadCurrentValues() {
      try {
        const [supplyRes, priceRes] = await Promise.all([
          fetch('/api/supply'),
          fetch('/api/price')
        ]);

        const supply = await supplyRes.json();
        const price = await priceRes.json();

        document.getElementById('currentSupply').textContent = supply.quantity || 0;
        document.getElementById('currentPrice').textContent = price.price ? '$' + price.price.toFixed(2) : '$0.00';
      } catch (error) {
        console.error('Error loading current values:', error);
      }
    }

    async function setSupply() {
      const quantity = document.getElementById('supply').value;
      if (!quantity || quantity < 0) {
        showStatus('Please enter a valid quantity', 'error');
        return;
      }

      try {
        const response = await fetch('/api/supply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ quantity: parseInt(quantity) })
        });

        if (response.ok) {
          const result = await response.json();
          showStatus('Supply updated successfully!', 'success');
          document.getElementById('currentSupply').textContent = result.quantity;
          document.getElementById('supply').value = '';
        } else {
          showStatus('Error updating supply', 'error');
        }
      } catch (error) {
        showStatus('Network error: ' + error.message, 'error');
      }
    }

    async function setPrice() {
      const price = document.getElementById('price').value;
      if (!price || price < 0) {
        showStatus('Please enter a valid price', 'error');
        return;
      }

      try {
        const response = await fetch('/api/price', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ price: parseFloat(price) })
        });

        if (response.ok) {
          const result = await response.json();
          showStatus('Price updated successfully!', 'success');
          document.getElementById('currentPrice').textContent = '$' + result.price.toFixed(2);
          document.getElementById('price').value = '';
        } else {
          showStatus('Error updating price', 'error');
        }
      } catch (error) {
        showStatus('Network error: ' + error.message, 'error');
      }
    }

    function showStatus(message, type) {
      const statusDiv = document.getElementById('status');
      const statusMessage = document.getElementById('statusMessage');

      statusMessage.textContent = message;
      statusDiv.style.display = 'block';

      if (type === 'error') {
        statusDiv.style.backgroundColor = '#f8d7da';
        statusDiv.style.borderColor = '#f5c6cb';
        statusDiv.style.color = '#721c24';
      } else {
        statusDiv.style.backgroundColor = '#e8f5e8';
        statusDiv.style.borderColor = '#c3e6c3';
        statusDiv.style.color = '#2d5a2d';
      }

      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  </script>
</body>
</html>
`;

// API Definition
const api = HttpApi.make('chicken')
  .add(
    HttpApiGroup.make('supply')
      .add(
        HttpApiEndpoint.get('getSupply', '/api/supply')
          .addSuccess(
            S.Union(
              EggSupplySchema,
              S.Struct({ quantity: S.Number, updatedAt: S.Date }),
            ),
          )
      )
      .add(
        HttpApiEndpoint.post('setSupply', '/api/supply')
          .setPayload(SetSupplySchema)
          .addSuccess(EggSupplySchema)
      ),
  )
  .add(
    HttpApiGroup.make('price')
      .add(
        HttpApiEndpoint.get('getPrice', '/api/price')
          .addSuccess(
            S.Union(
              EggPriceSchema,
              S.Struct({ price: S.Number, updatedAt: S.Date }),
            ),
          )
      )
      .add(
        HttpApiEndpoint.post('setPrice', '/api/price')
          .setPayload(SetPriceSchema)
          .addSuccess(EggPriceSchema)
      ),
  )
  .add(
    HttpApiGroup.make('frontend')
      .add(
        HttpApiEndpoint.get('home', '/')
          .addSuccess(S.String)
      ),
  );

// Server Handlers - Using global state for persistence
const getSupply = Effect.gen(function* () {
  const supply = globalThis.CHICKEN_SUPPLY_STATE;
  return supply || { quantity: 0, updatedAt: new Date() };
});

const setSupply = (payload: { quantity: number }) =>
  Effect.gen(function* () {
    const supply: EggSupply = {
      id: crypto.randomUUID(), // Available in Cloudflare Workers
      quantity: payload.quantity,
      updatedAt: new Date(),
    };
    globalThis.CHICKEN_SUPPLY_STATE = supply;
    return supply;
  });

const getPrice = Effect.gen(function* () {
  const price = globalThis.CHICKEN_PRICE_STATE;
  return price || { price: 0, updatedAt: new Date() };
});

const setPrice = (payload: { price: number }) =>
  Effect.gen(function* () {
    const price: EggPrice = {
      id: crypto.randomUUID(), // Available in Cloudflare Workers
      price: payload.price,
      updatedAt: new Date(),
    };
    globalThis.CHICKEN_PRICE_STATE = price;
    return price;
  });

const home = Effect.succeed(htmlContent);

// API Implementation
const SupplyApiLive = HttpApiBuilder.group(api, 'supply', handlers =>
  handlers
    .handle('getSupply', () => getSupply)
    .handle('setSupply', ({ payload }) => setSupply(payload)),
);

const PriceApiLive = HttpApiBuilder.group(api, 'price', handlers =>
  handlers
    .handle('getPrice', () => getPrice)
    .handle('setPrice', ({ payload }) => setPrice(payload)),
);

const FrontendApiLive = HttpApiBuilder.group(api, 'frontend', handlers =>
  handlers.handle('home', () => home),
);

const ApiLive = HttpApiBuilder.api(api);

// Chicken API Live Layer (simplified without Refs)
export const ChickenApiLive = Layer.mergeAll(
  ApiLive,
  SupplyApiLive,
  PriceApiLive,
  FrontendApiLive,
);

// Cloudflare Worker Export
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const { handler } = HttpApiBuilder.toWebHandler(
      Layer.mergeAll(ChickenApiLive, HttpServer.layerContext) as any,
    );

    return handler(request, Context.empty());
  },
};
