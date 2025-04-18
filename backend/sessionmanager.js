const session = require('express-session');

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'secret123',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',   // Lax is okay for localhost, NOT 'none'
    secure: false      // ✅ IMPORTANT: false on localhost
  }
});

module.exports = sessionMiddleware;
