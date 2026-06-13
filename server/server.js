const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRouter = require('./src/controllers/authController');
const groupRouter = require('./src/controllers/groupController');
const expenseRouter = require('./src/controllers/expenseController');
const settlementRouter = require('./src/controllers/settlementController');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL, 
  'http://localhost:5173'    
];

app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow server-to-server or curl requests
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, "");

    // 2. Match allowed origins and any vercel preview deployments (*.vercel.app)
    const isExplicitlyAllowed = allowedOrigins.some(domain => domain && domain.replace(/\/$/, "") === cleanOrigin);
    const isVercelSubdomain = cleanOrigin.endsWith('.vercel.app');

    if (isExplicitlyAllowed || isVercelSubdomain) {
      callback(null, true);
    } else {
      console.error(`[CORS Blocked] Rejected origin: "${origin}"`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mount modular routes
app.use('/api/auth', authRouter);
app.use('/api/groups', groupRouter);
app.use('/api', expenseRouter);
app.use('/api', settlementRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Splitwise Separated Backend API is active.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
