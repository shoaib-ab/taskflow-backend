import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minLength: 6,
      select: false,
    },
    // Stores the current valid refresh token (allows single-device invalidation / rotation)
    refreshToken: {
      type: String,
      default: null,
      select: false, // Never returned in normal queries
    },
    auth0Id: {
      type: String,
      unique: true,
      sparse: true, // Allow nulls for non-social users
    },
    role: {
      type: String,
      enum: ['member', 'manager', 'admin'],
      default: 'member',
    },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
