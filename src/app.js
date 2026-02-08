import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test Route
app.get('/', (req, res) => {
  res.send('TASK MANAGEMENT API is running');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Global error handler

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message || 'Server Error',
  });
});
export default app;
