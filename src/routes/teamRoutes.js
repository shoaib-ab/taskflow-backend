import express from 'express';
import protect, { authorize } from '../middleware/authMiddleware.js';
import {
  addMember,
  createTeam,
  deleteTeam,
  getMyTeams,
  getTeamTasks,
  removeMember,
} from '../controllers/teamController.js';

const router = express.Router();

router.post('/', protect, authorize('admin', 'manager'), createTeam);
router.get('/', protect, authorize('manager', 'admin'), getMyTeams);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteTeam);
router.post('/:id/members', protect, authorize('manager', 'admin'), addMember);
router.delete(
  '/:id/members/:uid',
  protect,
  authorize('manager', 'admin'),
  removeMember,
);
router.get('/:id/tasks', protect, authorize('manager', 'admin'), getTeamTasks);

export default router;
