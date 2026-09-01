const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const users = await pool.query("SELECT COUNT(*) FROM users");
    const jobs = await pool.query("SELECT COUNT(*) FROM job_listings WHERE is_active = true");
    const posts = await pool.query("SELECT COUNT(*) FROM forum_posts");
    const applications = await pool.query("SELECT COUNT(*) FROM job_applications");
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      activeJobs: parseInt(jobs.rows[0].count),
      forumPosts: parseInt(posts.rows[0].count),
      totalApplications: parseInt(applications.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
