import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';

// ─── Token Helpers ────────────────────────────────────────────────────────────

/**
 * Generates a short-lived access token (15 minutes).
 * This token is used to authenticate every protected API request.
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
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
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
};

/**
 * Sets both tokens as httpOnly cookies on the response and
 * persists the refresh token in the database (enables rotation & revocation).
 */
const attachTokens = async (res, user) => {
  const accessToken = generateAccessToken(user._id);
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
    user: { id: user._id, name: user.name, email: user.email },
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
    user: { id: user._id, name: user.name, email: user.email },
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
    user: { id: user._id, name: user.name, email: user.email },
  });
});
