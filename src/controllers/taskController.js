import Task from '../models/Task.js';
import asyncHandler from '../utils/asyncHandler.js';
import cloudinary, { uploadToCloudinary } from '../config/cloudinary.js';
import fs from 'fs';
// CREATE

export const createTask = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

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
  });

  res.status(201).json({
    success: true,
    task,
  });
});

// READ (my tasks)

export const getMyTasks = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 10;
  const skip = (page - 1) * limit;

  let query = { userId: req.user._id };

  if (req.query.status) {
    query.status = req.query.status;
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

// UPDATE

export const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, status } = req.body;
  const task = await Task.findOne({ _id: id, userId: req.user._id });

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  task.title = title || task.title;
  task.description = description || task.description;
  task.status = status || task.status;

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
  const task = await Task.findOne({ _id: id, userId: req.user._id });

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
