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


const nodemailer = require('nodemailer');
const otps = {}; // memory store for otps

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email gerekli' });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps[email] = { code: otp, expires: Date.now() + 10*60000 };
  
  if (!process.env.SMTP_USER) {
      console.log('OTP for ' + email + ' is ' + otp);
      return res.json({ message: 'OTP gonderildi (Console logger devrede)' });
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Kariyerim.com Dogrulama Kodu',
      text: `Kayit olmak icin dogrulama kodunuz: ${otp}`
    });
    res.json({ message: 'OTP mail olarak gonderildi' });
  } catch(e) {
    console.log(e);
    res.status(500).json({ error: 'Mail gonderilemedi' });
  }
});

router.post('/register-otp', async (req, res) => {
  const { username, email, password, full_name, otp } = req.body;
  if (!otps[email] || otps[email].code !== otp || otps[email].expires < Date.now()) {
    return res.status(400).json({ error: 'Gecersiz veya suresi dolmus dogrulama kodu' });
  }
  // Remove OTP
  delete otps[email];
  
  // Proceed with registration
  try {
    const existing = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Kullanici adi veya email zaten kullanimda' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, email, full_name, created_at',
      [username, email, hash, full_name]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '24h' });

    res.status(201).json({ message: 'Kayıt basarili', token, user });
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatasi' });
  }
});

router.post('/google', async (req, res) => {
  const { token, userProfile } = req.body; // In a real app verify the google token via google-auth-library
  // For MVP, we trust the profile sent if it's verified on client side
  const { email, name, picture } = userProfile;
  
  try {
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = result.rows[0];
    
    if (!user) {
        // Create user
        const username = email.split('@')[0] + Math.floor(Math.random()*1000);
        const hash = await bcrypt.hash(username + Date.now(), 10);
        const insertRes = await pool.query(
            'INSERT INTO users (username, email, password_hash, full_name, avatar_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [username, email, hash, name, picture]
        );
        user = insertRes.rows[0];
    }
    
    const jwtToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '24h' });
    res.status(200).json({ message: 'Giris basarili', token: jwtToken, user });
  } catch (e) {
    res.status(500).json({ error: 'Sunucu hatasi' });
  }
});

module.exports = router;
