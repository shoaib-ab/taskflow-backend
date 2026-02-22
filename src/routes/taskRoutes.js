import express from 'express';
import protect, { authorize } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

import {
  createTask,
  getMyTasks,
  updateTask,
  deleteTask,
  getAllTasks,
  getTaskById,
} from '../controllers/taskController.js';

const router = express.Router();

router.post('/', protect, upload.single('image'), createTask);
router.get('/mytasks', protect, getMyTasks);
router.put('/:id', protect, upload.single('image'), updateTask);
router.delete('/:id', protect, deleteTask);
router.get('/all', protect, authorize('manager', 'admin'), getAllTasks);
router.get('/:id', protect, getTaskById);

export default router;
