import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    role: 'admin' | 'manager' | 'staff';
    staffId?: string;
    organizationId: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ message: 'Access token required' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not set');
      res.status(500).json({ message: 'Server configuration error' });
      return;
    }

    const decoded = jwt.verify(token, secret) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        staffId: true,
        organizationId: true,
      }
    });

    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    // If user has no org (registered before multi-tenancy), auto-create one
    let organizationId = user.organizationId;
    if (!organizationId) {
      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: `${user.firstName ?? user.username}'s Organisation`, updatedAt: new Date() }
        });
        await tx.user.update({ where: { id: user.id }, data: { organizationId: org.id } });
        return org.id;
      });
      organizationId = result;
    }

    req.user = {
      ...user,
      staffId: user.staffId ?? undefined,
      organizationId,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ message: 'Invalid token' });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: 'Token expired' });
      return;
    }
    res.status(500).json({ message: 'Authentication error' });
  }
};

export const requireRole = (...roles: Array<'admin' | 'manager' | 'staff'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }
    next();
  };
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    if (token && secret) {
      const decoded = jwt.verify(token, secret) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          staffId: true,
          organizationId: true,
        }
      });
      if (user && user.organizationId) {
        req.user = {
          ...user,
          staffId: user.staffId ?? undefined,
          organizationId: user.organizationId,
        };
      }
    }
    next();
  } catch {
    next();
  }
};
