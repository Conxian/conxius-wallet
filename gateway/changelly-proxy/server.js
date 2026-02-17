const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const API_URL = 'https://api.changelly.com/v2';
const API_KEY = process.env.CHANGELLY_API_KEY;
const API_SECRET = process.env.CHANGELLY_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('Missing CHANGELLY_API_KEY or CHANGELLY_API_SECRET');
  process.exit(1);
}

app.post('/', async (req, res) => {
  const message = req.body;
  
  // Basic validation
  if (!message.jsonrpc || !message.method) {
    return res.status(400).json({ error: 'Invalid JSON-RPC request' });
  }

  // Allow only specific methods for safety
  const ALLOWED_METHODS = ['getCurrenciesFull', 'getExchangeAmount', 'createTransaction', 'getMinAmount'];
  if (!ALLOWED_METHODS.includes(message.method)) {
    return res.status(403).json({ error: 'Method not allowed by proxy policy' });
  }

  try {
    const bodyString = JSON.stringify(message);
    const sign = crypto
      .createHmac('sha512', API_SECRET)
      .update(bodyString)
      .digest('hex');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
        'sign': sign
      },
      body: bodyString
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Internal Proxy Error' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Changelly Proxy running on port ${PORT}`);
});
