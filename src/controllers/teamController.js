import asyncHandler from '../utils/asyncHandler.js';
import Team from '../models/Team.js';
import mongoose from 'mongoose';
import Task from '../models/Task.js';
// CREATE TEAM

export const createTeam = asyncHandler(async (req, res) => {
  const { name, managerId } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Team name is required' });
  }

  // Admin can assign any manager; manager becomes their own team's manager
  const resolvedManager =
    req.user.role === 'admin' && managerId ? managerId : req.user._id;

  const team = await Team.create({
    name,
    manager: resolvedManager,
    createdBy: req.user._id,
  });

  const populated = await team.populate('manager', 'name email');

  res.status(201).json({
    success: true,
    message: 'Team created successfully',
    team: populated,
  });
});

// GET MY TEAMS

export const getMyTeams = asyncHandler(async (req, res) => {
  let query = {};

  if (req.user.role === 'manager') {
    query = { manager: req.user._id };
  }

  const teams = await Team.find(query)
    .populate('manager', 'name email')
    .populate('members', 'name email');

  res.status(200).json({
    success: true,
    count: teams.length,
    teams,
  });
});

// ADD MEMBER TO TEAM

export const addMember = asyncHandler(async (req, res) => {
  const { id: teamId } = req.params;
  const { userId } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(teamId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return res.status(400).json({ message: 'Invalid team or user ID' });
  }

  const team = await Team.findById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }

  if (
    req.user.role === 'manager' &&
    team.manager.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: 'Forbidden: not team manager' });
  }

  if (team.members.includes(userId)) {
    return res
      .status(400)
      .json({ message: 'User is already a member of the team' });
  }

  team.members.push(userId);
  await team.save();
  await team.populate('manager', 'name email');
  await team.populate('members', 'name email');

  res.status(200).json({
    success: true,
    message: 'Member added to team successfully',
    team,
  });
});

// REMOVE MEMBER FROM TEAM

export const removeMember = asyncHandler(async (req, res) => {
  const { id: teamId, uid: userId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(teamId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return res.status(400).json({ message: 'Invalid team or user ID' });
  }

  const team = await Team.findById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }

  if (
    req.user.role === 'manager' &&
    team.manager.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: 'Forbidden: not team manager' });
  }

  if (!team.members.includes(userId)) {
    return res
      .status(400)
      .json({ message: 'User is not a member of the team' });
  }

  team.members = team.members.filter(
    (memberId) => memberId.toString() !== userId,
  );
  await team.save();
  await team.populate('manager', 'name email');
  await team.populate('members', 'name email');

  res.status(200).json({
    success: true,
    message: 'Member removed from team successfully',
    team,
  });
});

// DELETE TEAM

export const deleteTeam = asyncHandler(async (req, res) => {
  const { id: teamId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    return res.status(400).json({ message: 'Invalid team ID' });
  }

  const team = await Team.findById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }

  // Only admin or the team's own manager can delete it
  if (
    req.user.role === 'manager' &&
    team.manager.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: 'Forbidden: not team manager' });
  }

  await team.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Team deleted successfully',
  });
});

// GET TEAM TASKS

export const getTeamTasks = asyncHandler(async (req, res) => {
  const { id: teamId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    return res.status(400).json({ message: 'Invalid team ID' });
  }

  const team = await Team.findById(teamId);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }

  if (
    req.user.role === 'manager' &&
    team.manager.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: 'Forbidden: not team manager' });
  }

  const tasks = await Task.find({ teamId }).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    count: tasks.length,
    tasks,
  });
});
