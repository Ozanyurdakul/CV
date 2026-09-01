const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, full_name, bio, location, avatar_url, linkedin_url, github_url, website_url, skills, created_at FROM users WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanici bulunamadi.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/me', auth, async (req, res) => {
  const { full_name, bio, location, linkedin_url, github_url, website_url, skills } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), bio = COALESCE($2, bio), location = COALESCE($3, location),
       linkedin_url = COALESCE($4, linkedin_url), github_url = COALESCE($5, github_url), website_url = COALESCE($6, website_url),
       skills = COALESCE($7, skills), updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING id, username, email, full_name, bio, location, avatar_url, linkedin_url, github_url, website_url, skills`,
      [full_name, bio, location, linkedin_url, github_url, website_url, JSON.stringify(skills || []), req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { search, skill } = req.query;
    let query = "SELECT id, username, full_name, bio, location, avatar_url, skills, created_at FROM users WHERE 1=1";
    const params = [];
    if (search) {
      params.push('%' + search + '%');
      query += ` AND (full_name ILIKE $${params.length} OR username ILIKE $${params.length} OR bio ILIKE $${params.length})`;
    }
    if (skill) {
      params.push(skill);
      query += ` AND skills::text ILIKE '%' || $${params.length} || '%'`;
    }
    query += " ORDER BY created_at DESC LIMIT 50";
    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
