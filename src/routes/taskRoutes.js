import express from 'express';
import protect from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import {
  createTask,
  getMyTasks,
  updateTask,
  deleteTask,
} from '../controllers/taskController.js';

const router = express.Router();

router.post('/', protect, upload.single('image'), createTask);
router.get('/mytasks', protect, getMyTasks);
router.put('/:id', protect, upload.single('image'), updateTask);
router.delete('/:id', protect, deleteTask);

export default router;
