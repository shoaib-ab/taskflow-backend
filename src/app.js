import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

// Middleware
// credentials:true is required so the browser sends cookies on cross-origin requests.
// Replace the origin value with your actual frontend URL in production.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // Allow cookies to be sent with cross-origin requests
  }),
);
app.use(express.json());
app.use(cookieParser()); // Parse Cookie header and populate req.cookies

// Test Route
app.get('/', (req, res) => {
  res.send('TASK MANAGEMENT API is running');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/users', userRoutes);

// Global error handler

app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});
export default app;
