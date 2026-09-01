const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'devops_db',
});

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(255),
        bio TEXT,
        location VARCHAR(255),
        avatar_url TEXT,
        linkedin_url TEXT,
        github_url TEXT,
        website_url TEXT,
        skills JSONB DEFAULT '[]',
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cv_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        template_name VARCHAR(50) DEFAULT 'classic',
        sections JSONB DEFAULT '[]',
        is_public BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS job_listings (
        id SERIAL PRIMARY KEY,
        posted_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        location VARCHAR(255),
        work_type VARCHAR(20) DEFAULT 'office',
        experience_level VARCHAR(50),
        salary_range VARCHAR(100),
        sector VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        deadline DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS job_applications (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES job_listings(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        cover_letter TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(job_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS forum_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        post_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS forum_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES forum_categories(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        likes_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS forum_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS forum_likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        UNIQUE(user_id, post_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const bcrypt = require('bcrypt');
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@platform.com';

    const adminCheck = await pool.query("SELECT * FROM users WHERE username = $1", [adminUser]);
    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash(adminPass, 10);
      await pool.query(
        "INSERT INTO users (username, email, password_hash, full_name, is_admin) VALUES ($1, $2, $3, $4, $5)",
        [adminUser, adminEmail, hash, 'Platform Admin', true]
      );
    }

    const catCheck = await pool.query("SELECT * FROM forum_categories");
    if (catCheck.rows.length === 0) {
      const categories = [
        ['Kariyer Tavsiyeleri', 'Kariyer yolculugunuzda ihtiyac duydugunuz tavsiyeler', 'briefcase'],
        ['Teknik Sorular', 'Yazilim, muhendislik ve teknik konularda sorular', 'code'],
        ['Mulakat Deneyimleri', 'Is gorusmesi deneyimlerini paylasin', 'users'],
        ['Serbest Sohbet', 'Her konuda serbest tartisma', 'message-circle']
      ];
      for (const cat of categories) {
        await pool.query(
          "INSERT INTO forum_categories (name, description, icon) VALUES ($1, $2, $3)",
          cat
        );
      }
    }

    console.log('Veritabani baslatildi ve hazir.');
  } catch (err) {
    console.error('Veritabani baslatilamadi:', err);
  }
};

module.exports = { pool, initDB };
