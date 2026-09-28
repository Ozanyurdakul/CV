require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initDB } = require('./db');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/cv', require('./routes/cv'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/forum', require('./routes/forum'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/stats', require('./routes/stats'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

setTimeout(initDB, 3000);

app.listen(port, () => console.log('Backend server running on port ' + port));
