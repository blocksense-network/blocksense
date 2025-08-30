import express, { Request, Response } from 'express';

interface EggSupply {
  id: string;
  quantity: number;
  updatedAt: Date;
}

interface EggPrice {
  id: string;
  price: number;
  updatedAt: Date;
}

// Simple in-memory storage
let currentSupply: EggSupply | null = null;
let currentPrice: EggPrice | null = null;

const app = express();
app.use(express.json());

// API Routes
app.get('/api/supply', (req: Request, res: Response) => {
  res.json(currentSupply || { quantity: 0, updatedAt: new Date() });
});

app.post('/api/supply', (req: Request, res: Response) => {
  const quantity = req.body.quantity;
  if (typeof quantity !== 'number' || quantity < 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  currentSupply = {
    id: crypto.randomUUID(),
    quantity,
    updatedAt: new Date(),
  };

  res.json(currentSupply);
});

app.get('/api/price', (req: Request, res: Response) => {
  res.json(currentPrice || { price: 0, updatedAt: new Date() });
});

app.post('/api/price', (req: Request, res: Response) => {
  const price = req.body.price;
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  currentPrice = {
    id: crypto.randomUUID(),
    price,
    updatedAt: new Date(),
  };

  res.json(currentPrice);
});

// Frontend HTML
app.get('/', (req: Request, res: Response) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Egg Management System</title>
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
        // Load current values on page load
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
  res.send(html);
});

// Start the server
const PORT = 3000;

console.log('🥚 Starting Egg Management Server...');

app.listen(PORT, () => {
  console.log('🚀 Server running on http://localhost:' + PORT);
  console.log('📊 Available endpoints:');
  console.log('  GET  /api/supply - Get current egg supply');
  console.log('  POST /api/supply - Set egg supply');
  console.log('  GET  /api/price  - Get current egg price');
  console.log('  POST /api/price  - Set egg price');
  console.log('  GET  /          - Web interface');
});
