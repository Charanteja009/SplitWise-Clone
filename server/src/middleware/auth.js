const jwt = require('jsonwebtoken');

/**
 * Express middleware to authenticate requests via JWT stored in HttpOnly cookies.
 */
function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in.' });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-token-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach user payload (id, email, name) to request
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = { authenticateToken };
