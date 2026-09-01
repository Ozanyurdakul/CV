const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token bulunamadi.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Gecersiz veya suresi dolmus token.' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Yetkiniz yok.' });
  next();
};

module.exports = authMiddleware;
module.exports.adminMiddleware = adminMiddleware;
