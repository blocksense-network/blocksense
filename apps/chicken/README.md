# 🥚 Egg Management System

A web application with backend built using **Effect-TS** for functional programming and **Express.js** for HTTP handling.

## Features

✅ **Two Forms on Web Interface:**
- Set egg supply (quantity)
- Set egg price (dollar amount)

✅ **Local Database Storage:**
- In-memory storage using Effect-TS Ref for state management
- Automatic ID generation with timestamps

✅ **Backend API Endpoints:**
- `GET /api/supply` - Query current egg supply
- `POST /api/supply` - Set new egg supply
- `GET /api/price` - Query current egg price  
- `POST /api/price` - Set new egg price

✅ **Modern Web Interface:**
- Responsive design with clean UI
- Real-time display of current values
- Form validation and error handling
- Success/error status messages

## Tech Stack

- **Backend:** Node.js + Express.js + Effect-TS
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Database:** In-memory using Effect-TS Ref
- **Language:** TypeScript
- **Package Manager:** Yarn

## Project Structure

```
src/
├── main.ts              # Simple Express server
├── effect-main.ts       # Effect-TS powered server
├── database/
│   ├── database.ts      # Simple database interface
│   └── effect-database.ts  # Effect-TS database service
├── models/
│   └── egg.ts          # Data models and schemas
└── routes/
    └── routes.ts       # HTTP routes (unused in current impl)
```

## Running the Application

### Simple Version (Express only)
```bash
yarn dev
```
Server runs on: http://localhost:3000

### Effect-TS Version (Functional Programming)
```bash
yarn dev:effect
```
Server runs on: http://localhost:3001

## API Usage Examples

### Set Supply
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"quantity": 100}' \
  http://localhost:3000/api/supply
```

### Get Supply
```bash
curl -X GET http://localhost:3000/api/supply
```

### Set Price
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"price": 2.50}' \
  http://localhost:3000/api/price
```

### Get Price
```bash
curl -X GET http://localhost:3000/api/price
```

## Effect-TS Features Demonstrated

1. **Service Pattern**: Database as a service with dependency injection
2. **Effect Composition**: Using `Effect.gen` for sequential operations
3. **Type Safety**: Strong typing throughout the application
4. **Functional Programming**: Immutable state management with Ref
5. **Error Handling**: Built-in error handling with Effect types

## Data Models

### EggSupply
```typescript
interface EggSupply {
  id: string
  quantity: number
  updatedAt: Date
}
```

### EggPrice
```typescript
interface EggPrice {
  id: string
  price: number
  updatedAt: Date
}
```

## Future Enhancements

- [ ] Persist data to file system or database
- [ ] Add authentication and authorization
- [ ] Add data validation with Effect Schema
- [ ] Add logging and monitoring
- [ ] Add unit tests with Effect Test
- [ ] Add batch operations
- [ ] Add historical data tracking
- [ ] Add real-time updates with WebSockets

## Development

### Install Dependencies
```bash
yarn install
```

### Build for Production
```bash
yarn build
```

### Start Production Server
```bash
yarn start
```

This project demonstrates how to build a functional web application using Effect-TS for backend logic while maintaining a simple and intuitive user interface.
