import express from 'express';
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  updateProfile,
  updatePassword,
  deleteAccount,
} from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
router.patch('/password', protect, updatePassword);
router.delete('/account', protect, deleteAccount);

export default router;
