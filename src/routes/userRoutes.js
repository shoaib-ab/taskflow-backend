import express from 'express';
import protect, { authorize } from '../middleware/authMiddleware.js';
import {
  changeRole,
  deleteUser,
  getAllUsers,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), getAllUsers);
router.patch('/:id/role', protect, authorize('admin'), changeRole);
router.delete('/:id', protect, authorize('admin'), deleteUser);

export default router;
