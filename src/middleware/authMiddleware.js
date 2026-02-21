import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * protect middleware
 *
 * Reads the access token from the httpOnly cookie set during login/register.
 * If the token is missing or invalid the request is rejected with 401.
 * When the access token is expired the client should call POST /api/auth/refresh
 * to get a new pair before retrying the original request.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no access token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    next();
  } catch (error) {
    // Distinguish between an expired token and a tampered one so the client
    // knows whether a refresh attempt is worth making.
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
});

export default protect;
