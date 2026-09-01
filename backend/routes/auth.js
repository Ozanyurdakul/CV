const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { pool } = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

router.post('/register', async (req, res) => {
  const { username, email, password, full_name } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Kullanici adi, email ve sifre zorunlu.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, email, full_name, is_admin",
      [username, email, hash, full_name || username]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name, isAdmin: user.is_admin } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Bu kullanici adi veya email zaten alinmis.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1 OR email = $1", [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Kullanici bulunamadi.' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Hatali sifre.' });
    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name, isAdmin: user.is_admin, avatarUrl: user.avatar_url } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await pool.query("SELECT id, username, email, full_name, bio, location, avatar_url, linkedin_url, github_url, website_url, skills, is_admin, created_at FROM users WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanici bulunamadi.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
