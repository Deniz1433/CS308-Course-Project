// backend/sessionmanager.js
const session = require('express-session');

const backendSession = session({
  secret: process.env.SESSION_SECRET || 'your_secret_key', // use env variables in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // set true if using HTTPS in production
    maxAge: 1000 * 60 * 60, // session lasts for 1 hour
  },
});

module.exports = backendSession;
