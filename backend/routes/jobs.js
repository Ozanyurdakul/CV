const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { search, location, work_type, sector, experience_level } = req.query;
    let query = "SELECT j.*, u.username, u.full_name, u.avatar_url, (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count FROM job_listings j JOIN users u ON j.posted_by = u.id WHERE j.is_active = true";
    const params = [];
    if (search) { params.push('%' + search + '%'); query += ` AND (j.title ILIKE $${params.length} OR j.company ILIKE $${params.length} OR j.description ILIKE $${params.length})`; }
    if (location) { params.push('%' + location + '%'); query += ` AND j.location ILIKE $${params.length}`; }
    if (work_type) { params.push(work_type); query += ` AND j.work_type = $${params.length}`; }
    if (sector) { params.push('%' + sector + '%'); query += ` AND j.sector ILIKE $${params.length}`; }
    if (experience_level) { params.push(experience_level); query += ` AND j.experience_level = $${params.length}`; }
    query += " ORDER BY j.created_at DESC LIMIT 50";
    const result = await pool.query(query, params);
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT j.*, u.username, u.full_name, u.avatar_url, (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count FROM job_listings j JOIN users u ON j.posted_by = u.id WHERE j.id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ilan bulunamadi.' });
    res.json({ job: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { title, company, description, location, work_type, experience_level, salary_range, sector, deadline } = req.body;
  if (!title || !company || !description) return res.status(400).json({ error: 'Baslik, sirket ve aciklama zorunlu.' });
  try {
    const result = await pool.query(
      "INSERT INTO job_listings (posted_by, title, company, description, location, work_type, experience_level, salary_range, sector, deadline) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [req.user.id, title, company, description, location, work_type || 'office', experience_level, salary_range, sector, deadline]
    );
    res.json({ job: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/apply', auth, async (req, res) => {
  const { cover_letter } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO job_applications (job_id, user_id, cover_letter) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, req.user.id, cover_letter]
    );
    await pool.query(
      "INSERT INTO notifications (user_id, type, message, link) SELECT posted_by, 'application', $1, $2 FROM job_listings WHERE id = $3",
      [req.user.username + ' ilaniniza basvurdu.', '/jobs/' + req.params.id, req.params.id]
    );
    res.json({ application: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Bu ilana zaten basvurdunuz.' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/applications', auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT ja.*, u.username, u.full_name, u.avatar_url, u.email FROM job_applications ja JOIN users u ON ja.user_id = u.id WHERE ja.job_id = $1 ORDER BY ja.created_at DESC",
      [req.params.id]
    );
    res.json({ applications: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/applications/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'interview', 'accepted', 'rejected'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Gecersiz durum.' });
  try {
    const result = await pool.query(
      "UPDATE job_applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (result.rows.length > 0) {
      const statusMessages = { pending: 'Beklemede', interview: 'Mulakat asamasinda', accepted: 'Kabul edildi', rejected: 'Reddedildi' };
      await pool.query(
        "INSERT INTO notifications (user_id, type, message, link) VALUES ($1, 'application_update', $2, $3)",
        [result.rows[0].user_id, 'Basvurunuzun durumu guncellendi: ' + statusMessages[status], '/jobs/' + result.rows[0].job_id]
      );
    }
    res.json({ application: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
