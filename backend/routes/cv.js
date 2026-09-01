const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM cv_profiles WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
    res.json({ profiles: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT cp.*, u.full_name, u.username, u.avatar_url FROM cv_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.id = $1 AND cp.is_public = true",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'CV bulunamadi.' });
    res.json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { template_name, sections, is_public } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO cv_profiles (user_id, template_name, sections, is_public) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, template_name || 'classic', JSON.stringify(sections || []), is_public !== false]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { template_name, sections, is_public } = req.body;
  try {
    const result = await pool.query(
      "UPDATE cv_profiles SET template_name = COALESCE($1, template_name), sections = COALESCE($2, sections), is_public = COALESCE($3, is_public), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND user_id = $5 RETURNING *",
      [template_name, sections ? JSON.stringify(sections) : null, is_public, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'CV bulunamadi veya yetkiniz yok.' });
    res.json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM cv_profiles WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ message: 'CV silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
