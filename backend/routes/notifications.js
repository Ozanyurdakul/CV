const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30",
      [req.user.id]
    );
    const unreadCount = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
      [req.user.id]
    );
    res.json({ notifications: result.rows, unreadCount: parseInt(unreadCount.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/read-all', auth, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = true WHERE user_id = $1", [req.user.id]);
    res.json({ message: 'Tum bildirimler okundu.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/read', auth, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ message: 'Bildirim okundu.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
