const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mock the Vercel API environment
app.all('/api/manage-user', async (req, res) => {
  try {
    const module = await import('./api/manage-user.js');
    const manageUserHandler = module.default;
    await manageUserHandler(req, res);
  } catch (err) {
    console.error('API Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error locally' });
    }
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Local API Server running on http://localhost:${PORT}`);
  console.log('Ensure Vite proxy is configured to point /api to this port.');
});
