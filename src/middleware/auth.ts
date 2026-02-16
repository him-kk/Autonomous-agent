// ============================================
// Authentication Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '@/config/index.js';
import { User } from '@/models/User.js';
import { AuthenticationError, AuthorizationError } from './errorHandler.js';
import { logger } from '@/utils/logger.js';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Authenticate JWT token
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, config.auth.jwtSecret as jwt.Secret) as JwtPayload;
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      preferences: user.preferences
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

// Authenticate API key
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new AuthenticationError('No API key provided');
    }

    // Find user by API key
    const user = await User.findByApiKey(apiKey);
    
    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid API key');
    }

    // Check if user has available requests
    if (!user.hasAvailableRequests()) {
      throw new AuthorizationError('Request quota exceeded');
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      preferences: user.preferences
    };

    // Increment usage
    await user.incrementUsage();

    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.auth.jwtSecret as jwt.Secret) as JwtPayload;
    
    const user = await User.findById(decoded.userId);
    
    if (user && user.isActive) {
      req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        preferences: user.preferences
      };
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Authorize by role
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AuthorizationError('Insufficient permissions'));
      return;
    }

    next();
  };
};

// Generate JWT token
export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(
    payload, 
    config.auth.jwtSecret as jwt.Secret, 
    { 
      expiresIn: config.auth.jwtExpiresIn 
    } as jwt.SignOptions
  );
};

// Verify JWT token
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.auth.jwtSecret as jwt.Secret) as JwtPayload;
};