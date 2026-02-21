import express from 'express';
import {
  register,
  login,
  logout,
  refresh,
  getMe,
} from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register); // Create account → sets cookies
router.post('/login', login); // Sign in       → sets cookies
router.post('/refresh', refresh); // Rotate tokens using refresh-token cookie
router.post('/logout', logout); // Clear cookies + invalidate refresh token in DB

// Protected route (requires valid access token cookie)
router.get('/me', protect, getMe); // Get current user profile

export default router;
