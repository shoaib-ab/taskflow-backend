import Task from '../models/Task.js';
import Team from '../models/Team.js';
import asyncHandler from '../utils/asyncHandler.js';
import cloudinary, { uploadToCloudinary } from '../config/cloudinary.js';
import fs from 'fs';
// CREATE

export const createTask = asyncHandler(async (req, res) => {
  const { title, description, teamId, priority, dueDate } = req.body;
  // Default to self-assignment if not provided
  const assignedTo = req.body.assignedTo || req.user._id;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  let imageData = {};

  if (req.file) {
    const result = await uploadToCloudinary(req.file.path);
    fs.unlinkSync(req.file.path);

    imageData = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  }
  const task = await Task.create({
    title,
    description,
    image: imageData,
    userId: req.user._id,
    assignedTo: assignedTo || req.user._id,
    teamId: teamId,
    priority: priority || 'medium',
    dueDate: dueDate || null,
  });

  res.status(201).json({
    success: true,
    task,
  });
});

// READ (my tasks)

export const getMyTasks = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  let query = {};

  // Role-based scoping
  if (req.user.role === 'member') {
    query = { assignedTo: req.user._id };
  } else if (req.user.role === 'manager') {
    // Fetch the teams this manager owns, then scope to those teamIds
    const myTeams = await Team.find({ manager: req.user._id }).select('_id');
    const teamIds = myTeams.map((t) => t._id);
    query = { teamId: { $in: teamIds } };
  }
  // admin → query stays {} (sees everything)

  console.log('GetTasks Query:', query);

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (status && status !== 'ALL') {
    query.status = status;
  }

  const totalTasks = await Task.countDocuments(query);

  const tasks = await Task.find(query)
    .sort({
      createdAt: -1,
    })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    totalTasks,
    totalPages: Math.ceil(totalTasks / limit),
    tasks,
  });
});

// READ ALL TASKS (manager + admin)

export const getAllTasks = asyncHandler(async (req, res) => {
  const { search, status, assignedTo } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  let query = {};

  // Data scoping ONLY
  if (req.user.role === 'manager') {
    // Fetch the teams this manager owns, then scope to those teamIds
    const myTeams = await Team.find({ manager: req.user._id }).select('_id');
    const teamIds = myTeams.map((t) => t._id);
    query = { teamId: { $in: teamIds } };
  }
  // admin → query remains {}

  // Search filter
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Status filter
  if (status && status !== 'ALL') {
    query.status = status;
  }

  // Member filter
  if (assignedTo) {
    query.assignedTo = assignedTo;
  }

  const totalTasks = await Task.countDocuments(query);

  const tasks = await Task.find(query)
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    totalTasks,
    totalPages: Math.ceil(totalTasks / limit),
    tasks,
  });
});

// READ SINGLE TASK

export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let query = { _id: id };

  // Role-based visibility
  if (req.user.role === 'manager') {
    const myTeams = await Team.find({ manager: req.user._id }).select('_id');
    const teamIds = myTeams.map((t) => t._id);
    query.$or = [
      { teamId: { $in: teamIds } },
      { userId: req.user._id },
      { assignedTo: req.user._id },
    ];
  } else if (req.user.role === 'member') {
    query.$or = [{ assignedTo: req.user._id }, { userId: req.user._id }];
  }
  // admin → just { _id: id }

  const task = await Task.findOne(query)
    .populate('assignedTo', 'name email')
    .populate('userId', 'name email');

  if (!task) {
    return res.status(404).json({ message: 'Task not found or access denied' });
  }

  res.status(200).json({ success: true, task });
});

// UPDATE

export const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, dueDate } = req.body;
  const task = await Task.findOne({ _id: id, userId: req.user._id });

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  task.title = title || task.title;
  task.description = description || task.description;
  task.status = status || task.status;
  if (priority !== undefined) task.priority = priority;
  if (dueDate !== undefined) task.dueDate = dueDate || null;

  if (req.file) {
    if (task.image?.public_id) {
      await cloudinary.uploader.destroy(task.image.public_id);
    }

    const result = await uploadToCloudinary(req.file.path);
    fs.unlinkSync(req.file.path);

    task.image = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  }

  await task.save();
  res.status(200).json({
    success: true,
    task,
  });
});

// DELETE

export const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Admin can delete any task; manager can delete tasks in their teams;
  // members can only delete tasks they created
  let task;
  if (req.user.role === 'admin') {
    task = await Task.findById(id);
  } else if (req.user.role === 'manager') {
    const myTeams = await Team.find({ manager: req.user._id }).select('_id');
    const teamIds = myTeams.map((t) => t._id.toString());
    task = await Task.findOne({
      _id: id,
      $or: [{ userId: req.user._id }, { teamId: { $in: teamIds } }],
    });
  } else {
    task = await Task.findOne({ _id: id, userId: req.user._id });
  }

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  if (task.image?.public_id) {
    await cloudinary.uploader.destroy(task.image.public_id);
  }

  await task.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Task deleted successfully',
  });
});
