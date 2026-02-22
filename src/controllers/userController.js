import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password -refreshToken');
  res.json({ users });
});

const changeRole = asyncHandler(async (req, res) => {
  const { id } = req.params; // route param is :id
  const { role } = req.body;

  if (!['member', 'manager', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  // Prevent admin from demoting themselves
  if (req.user._id.toString() === id) {
    return res.status(400).json({ message: 'You cannot change your own role' });
  }

  const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select(
    '-password -refreshToken',
  );
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json({ message: 'Role updated successfully', user });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params; // route param is :id

  // Prevent admin from deleting themselves
  if (req.user._id.toString() === id) {
    return res
      .status(400)
      .json({ message: 'You cannot delete your own account' });
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json({ message: 'User deleted successfully' });
});

export { getAllUsers, changeRole, deleteUser };
