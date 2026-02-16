// ============================================
// Authentication Routes
// ============================================

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '@/models/User.js';
import { requestValidator } from '@/middleware/validator.js';
import { authLoginSchema, authRegisterSchema } from '@/middleware/validator.js';
import { asyncHandler } from '@/middleware/errorHandler.js';
import { generateToken, authenticate } from '@/middleware/auth.js';
import { logger } from '@/utils/logger.js';

const router = Router();

// Register new user
router.post(
  '/register',
  requestValidator.body(authRegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.validatedBody;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'User already exists with this email'
      });
      return;
    }

    // Create new user
    const user = new User({
      email,
      password,
      name,
      role: 'user'
    });

    await user.save();

    // Generate API key
    const apiKey = await user.generateApiKey();

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    logger.info('New user registered', { email, userId: user._id });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        apiKey
      }
    });
  })
);

// Login
router.post(
  '/login',
  requestValidator.body(authLoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.validatedBody;

    // Find user
    // ✅ Use the new static method
    const user = await User.findByEmailWithPassword(email);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
      return;
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    logger.info('User logged in', { email, userId: user._id });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          preferences: user.preferences
        },
        token
      }
    });
  })
);

// Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferences: user.preferences,
        usage: user.usage,
        subscription: user.subscription,
        apiKey: user.apiKey,
        createdAt: user.createdAt
      }
    });
  })
);

// Refresh API key
router.post(
  '/refresh-api-key',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const newApiKey = await user.generateApiKey();

    logger.info('API key refreshed', { userId: user._id });

    res.json({
      success: true,
      message: 'API key refreshed successfully',
      data: {
        apiKey: newApiKey
      }
    });
  })
);

// Update user preferences
router.patch(
  '/preferences',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const allowedUpdates = ['outputFormat', 'maxResults', 'depth', 'priority', 'notifications', 'language'];
    
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        (user.preferences as any)[key] = req.body[key];
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preferences: user.preferences
      }
    });
  })
);

// Get usage stats
router.get(
  '/usage',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await User.getUsageStats(req.user!.id);
    
    if (!stats) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: stats
    });
  })
);

export { router as authRouter };
