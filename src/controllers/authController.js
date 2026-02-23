import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';

// ─── Token Helpers ────────────────────────────────────────────────────────────

/**
 * Generates a short-lived access token (15 minutes).
 * This token is used to authenticate every protected API request.
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: '15m',
    },
  );
};

/**
 * Generates a long-lived refresh token (7 days).
 * This token is used ONLY to obtain a new access token when the current one expires.
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

/**
 * Cookie options shared by both tokens.
 * httpOnly  → JS in the browser cannot read the cookie (XSS protection).
 * sameSite  → CSRF protection (use 'none' + secure:true in production cross-origin setups).
 * secure    → only sent over HTTPS in production.
 */
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  // 'none' required for cross-origin (different domains in production).
  // 'lax' is fine for same-origin local development.
  sameSite: isProduction ? 'none' : 'lax',
  // secure must be true when sameSite is 'none' — only sent over HTTPS
  secure: isProduction,
};

/**
 * Sets both tokens as httpOnly cookies on the response and
 * persists the refresh token in the database (enables rotation & revocation).
 */
const attachTokens = async (res, user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user._id);

  // Persist hashed refresh token in DB so we can validate & rotate it
  user.refreshToken = refreshToken;
  await user.save();

  // Access token cookie: expires in 15 minutes
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes in ms
  });

  // Refresh token cookie: expires in 7 days
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });

  return { accessToken, refreshToken };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// POST /api/auth/register
// the response should include role in the user objectFit:
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: 'Please provide name, email and password' });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({ name, email, password: hashedPassword });

  await attachTokens(res, user);

  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: 'Please provide email and password' });
  }

  // +password & +refreshToken because both have select:false in the schema
  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  await attachTokens(res, user);

  res.json({
    message: 'Login successful',
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /api/auth/refresh
// Called by the client when the access token has expired.
// Validates the refresh token from the cookie, then issues a brand-new pair
// (refresh token rotation — the old refresh token is immediately invalidated).
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  // 1. Verify the JWT signature and expiry
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res
      .status(403)
      .json({ message: 'Invalid or expired refresh token' });
  }

  // 2. Look up the user and confirm the stored token matches (rotation check)
  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) {
    // Token reuse detected or user not found — clear cookies and reject
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    return res
      .status(403)
      .json({ message: 'Refresh token reuse detected. Please log in again.' });
  }

  // 3. Issue a new access token + rotate the refresh token
  await attachTokens(res, user);

  res.json({ message: 'Tokens refreshed successfully' });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    // Invalidate refresh token in the database
    await User.findOneAndUpdate(
      { refreshToken: token },
      { refreshToken: null },
    );
  }

  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);

  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me  (protected)
export const getMe = asyncHandler(async (req, res) => {
  // req.user is populated by the protect middleware
  const user = req.user;
  res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// PATCH /api/auth/profile  (protected)
export const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name: name.trim() },
    { new: true, runValidators: true },
  );

  res.json({
    message: 'Profile updated successfully',
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// PATCH /api/auth/password  (protected)
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res
      .status(400)
      .json({ message: 'All password fields are required' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New passwords do not match' });
  }
  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: 'New password must be at least 6 characters' });
  }

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: 'Password updated successfully' });
});

// DELETE /api/auth/account  (protected)
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res
      .status(400)
      .json({ message: 'Password confirmation is required' });
  }

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Password is incorrect' });
  }

  await user.deleteOne();

  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);

  res.json({ message: 'Account deleted successfully' });
});
