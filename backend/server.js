const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;


const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.warn("DIKKAT: JWT_SECRET tanımlanmamış! Çevre değişkenlerini kontrol edin.");
}

app.use(cors());
app.use(express.json());


const pool = new Pool({
  user: process.env.DB_USER || 'devops_user',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'guestbook',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});


const initDB = async () => {
  try {
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS cv_items (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL, -- experience, education, project, certificate
        title VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255),
        date_str VARCHAR(100),
        descriptions JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin';
    const adminCheck = await pool.query("SELECT * FROM users WHERE username = ", [adminUser]);
    if (adminCheck.rows.length === 0) {
      const hash = await bcrypt.hash(adminPass, 10);
      await pool.query(
        "INSERT INTO users (username, password_hash, is_admin) VALUES (, , )",
        [adminUser, hash, true]
      );
    }

    
    const cvCheck = await pool.query("SELECT * FROM cv_items");
    if (cvCheck.rows.length === 0) {
      const initialData = [
        ['experience', 'Turkcell Global Bilgi — Yazılım Mühendisliği Stajyeri', 'İstanbul, Türkiye', 'Şub 2026 – Haz 2026', JSON.stringify(["Java ve Spring Boot kullanarak büyük ölçekli bir Hastane Bilgi Sistemi içerisinde hasta yönetimi ve poliklinik modülleri için arka uç (backend) özelliklerini geliştirdi.", "Veri bütünlüğünü sağlamak için soft-delete mantığı ve denetim izleri (audit trail) uygulayarak Oracle veritabanı şemalarını yönetti.", "Karmaşık Maven bağımlılık çakışmalarını ayıklayarak çoklu modül derleme hatalarını çözdü.", "Agile/Scrum törenlerine katıldı, Jira üzerinden sprint görevlerini yönetti."])],
        ['experience', 'Turkcell Global Bilgi — Yazılım Stajyeri (App Ops)', 'Trabzon, Türkiye', 'Tem 2025 – Eyl 2025', JSON.stringify(["Coğrafi uzamsal analizler için düzensiz adres verilerini temizlemek ve normalize etmek amacıyla Regex kullanarak bir Python veri ardışık düzeni (pipeline) inşa etti.", "Çok kaynaklı koordinatları çıkarmak ve çapraz doğrulama yapmak için Google Places ve Yandex API'lerini entegre etti.", "Selenium WebDriver kullanarak harita servislerinden coğrafi konum verisi çekimini otomatize etti.", "Leaflet.js kullanarak interaktif bir rota görselleştirme web panosu geliştirdi."])],
        ['experience', 'AIESEC Türkiye — Finans ve Hukuktan Sorumlu Başkan Yardımcısı', 'Trabzon, Türkiye', '2021 – 2024', JSON.stringify(["Çok kültürlü bir organizasyon bünyesinde yerel komitenin finansal operasyonlarını, bütçe planlamasını ve yasal uyumluluğunu yönetti."])],
        ['project', 'Numerettin — Yapay Zeka Entegreli Mobil Koçluk Platformu', 'Kişisel Proje', '2025 – 2026', JSON.stringify(["Sıfır örneklemli (zero-shot) sınıflandırma için çift katmanlı bir yapay zeka güvenlik (guardrail) ardışık düzeni tasarlayıp uyguladı ve prompt optimizasyonu ile bulut çıkarım maliyetlerini minimize etti.", "Çıktıları doğrulamak ve LLM halüsinasyon risklerini ortadan kaldırmak için deterministik bir hesaplama motoru entegre etti.", "Python/Flask arka ucunu Render üzerinde canlıya aldı ve Firebase atomik işlemleri kullanarak bir sanal ekonomi yönetti."])],
        ['education', 'Karadeniz Teknik Üniversitesi — Yazılım Mühendisliği Lisans', 'Trabzon, Türkiye', '2019 – 2026', JSON.stringify(["Tez: Büyük Dil Modelleri ve Deterministik Algoritmalar Kullanılarak Kişiselleştirilmiş Mobil Koçluk Platformu Geliştirilmesi"])]
      ];
      
      for (const item of initialData) {
        await pool.query(
          "INSERT INTO cv_items (type, title, subtitle, date_str, descriptions) VALUES ($1, $2, $3, $4, $5)",
          item
        );
      }
      console.log("Başlangıç CV verileri (Seeding) yüklendi.");
    }
    console.log('Veritabanı başlatıldı ve hazır.');
  } catch (err) {
    console.error('Veritabanı başlatılamadı:', err);
  }
};
setTimeout(initDB, 5000);


const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token bulunamadı, lütfen giriş yapın.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
  next();
};



app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({error: 'Kullanıcı adı ve şifre zorunlu!'});
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, is_admin",
      [username, hash]
    );
    const token = jwt.sign({ id: result.rows[0].id, username, isAdmin: false }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.rows[0].id, username, isAdmin: false } });
  } catch (err) {
    res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış olabilir.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Hatalı şifre.' });
    
    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, isAdmin: user.is_admin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});



app.get('/api/cv', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cv_items ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/cv', authMiddleware, adminMiddleware, async (req, res) => {
  const { type, title, subtitle, date_str, descriptions } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO cv_items (type, title, subtitle, date_str, descriptions) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [type, title, subtitle, date_str, JSON.stringify(descriptions || [])]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.get('/api/comments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.content, c.created_at, u.username 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/comments', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if(!content) return res.status(400).json({error: 'Yorum boş olamaz!'});
  try {
    const result = await pool.query(
      'INSERT INTO comments (user_id, content) VALUES ($1, $2) RETURNING *',
      [req.user.id, content]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.listen(port, () => console.log(`Backend server running on port ${port}`));
