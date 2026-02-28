/**
 * seedAdmin.js — One-time script to create the first admin user.
 *
 * Run once from the backend directory:
 *   node src/utils/seedAdmin.js
 *
 * NEVER expose this as an API endpoint.
 * After running, delete or .gitignore this file if credentials are hardcoded.
 */

import dotenv from 'dotenv';
dotenv.config(); // Must be before any other imports that need env vars

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const ADMIN = {
  name: 'Super Admin',
  email: 'admin@taskflow.com',
  password: 'Admin@123456', // Change this after first login
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✔ Connected to MongoDB');

    // Prevent duplicate admins
    const existing = await User.findOne({ email: ADMIN.email });
    if (existing) {
      console.log(`⚠  Admin already exists: ${ADMIN.email}`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN.password, 10);

    const admin = await User.create({
      name: ADMIN.name,
      email: ADMIN.email,
      password: hashedPassword,
      role: 'admin',
    });

    console.log('✔ Admin user created successfully');
    console.log('──────────────────────────────────');
    console.log(`  Name  : ${admin.name}`);
    console.log(`  Email : ${admin.email}`);
    console.log(`  Role  : ${admin.role}`);
    console.log(`  ID    : ${admin._id}`);
    console.log('──────────────────────────────────');
    console.log('  Password:', ADMIN.password);
    console.log('  ⚠  Change this password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('✘ Seed failed:', error.message);
    process.exit(1);
  }
};

seed();
