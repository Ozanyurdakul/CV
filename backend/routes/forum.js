const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM forum_categories ORDER BY id ASC");
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/posts', async (req, res) => {
  try {
    const { category_id, search, sort } = req.query;
    let query = `SELECT fp.*, u.username, u.full_name, u.avatar_url, fc.name as category_name
      FROM forum_posts fp JOIN users u ON fp.user_id = u.id JOIN forum_categories fc ON fp.category_id = fc.id WHERE 1=1`;
    const params = [];
    if (category_id) { params.push(category_id); query += ` AND fp.category_id = $${params.length}`; }
    if (search) { params.push('%' + search + '%'); query += ` AND (fp.title ILIKE $${params.length} OR fp.content ILIKE $${params.length})`; }
    if (sort === 'popular') { query += " ORDER BY fp.likes_count DESC, fp.created_at DESC"; }
    else { query += " ORDER BY fp.created_at DESC"; }
    query += " LIMIT 50";
    const result = await pool.query(query, params);
    res.json({ posts: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const postResult = await pool.query(
      `SELECT fp.*, u.username, u.full_name, u.avatar_url, fc.name as category_name
       FROM forum_posts fp JOIN users u ON fp.user_id = u.id JOIN forum_categories fc ON fp.category_id = fc.id WHERE fp.id = $1`,
      [req.params.id]
    );
    if (postResult.rows.length === 0) return res.status(404).json({ error: 'Konu bulunamadi.' });
    const commentsResult = await pool.query(
      "SELECT fc.*, u.username, u.full_name, u.avatar_url FROM forum_comments fc JOIN users u ON fc.user_id = u.id WHERE fc.post_id = $1 ORDER BY fc.created_at ASC",
      [req.params.id]
    );
    res.json({ post: postResult.rows[0], comments: commentsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/posts', auth, async (req, res) => {
  const { category_id, title, content } = req.body;
  if (!category_id || !title || !content) return res.status(400).json({ error: 'Kategori, baslik ve icerik zorunlu.' });
  try {
    const result = await pool.query(
      "INSERT INTO forum_posts (user_id, category_id, title, content) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, category_id, title, content]
    );
    await pool.query("UPDATE forum_categories SET post_count = post_count + 1 WHERE id = $1", [category_id]);
    res.json({ post: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/posts/:id/comments', auth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Yorum bos olamaz.' });
  try {
    const result = await pool.query(
      "INSERT INTO forum_comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, req.user.id, content]
    );
    await pool.query("UPDATE forum_posts SET comment_count = comment_count + 1 WHERE id = $1", [req.params.id]);
    const post = await pool.query("SELECT user_id FROM forum_posts WHERE id = $1", [req.params.id]);
    if (post.rows[0] && post.rows[0].user_id !== req.user.id) {
      await pool.query(
        "INSERT INTO notifications (user_id, type, message, link) VALUES ($1, 'forum_reply', $2, $3)",
        [post.rows[0].user_id, req.user.username + ' konunuza yorum yapti.', '/forum/post/' + req.params.id]
      );
    }
    res.json({ comment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/posts/:id/like', auth, async (req, res) => {
  try {
    const existing = await pool.query("SELECT * FROM forum_likes WHERE user_id = $1 AND post_id = $2", [req.user.id, req.params.id]);
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM forum_likes WHERE user_id = $1 AND post_id = $2", [req.user.id, req.params.id]);
      await pool.query("UPDATE forum_posts SET likes_count = likes_count - 1 WHERE id = $1", [req.params.id]);
      res.json({ liked: false });
    } else {
      await pool.query("INSERT INTO forum_likes (user_id, post_id) VALUES ($1, $2)", [req.user.id, req.params.id]);
      await pool.query("UPDATE forum_posts SET likes_count = likes_count + 1 WHERE id = $1", [req.params.id]);
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
