import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

// Register user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('role').optional().isIn(['staff', 'manager'])
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password, firstName, lastName, role } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create organization + user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: `${firstName} ${lastName}'s Organisation`,
          updatedAt: new Date(),
        }
      });

      const newUser = await tx.user.create({
        data: {
          email, username, password: hashedPassword, firstName, lastName,
          role: role || 'admin', // first user of an org is admin
          organizationId: org.id
        },
        select: {
          id: true, email: true, username: true, firstName: true, lastName: true,
          role: true, staffId: true, organizationId: true,
          staff: { select: { id: true, name: true, staffType: true, gender: true } },
          createdAt: true, updatedAt: true
        }
      });

      return newUser;
    });

    const token = jwt.sign(
      { userId: result.id },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    return res.status(201).json({ message: 'User registered successfully', user: result, token });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, username: true, password: true,
        firstName: true, lastName: true, role: true, staffId: true, organizationId: true,
        staff: { select: { id: true, name: true, staffType: true, gender: true } }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({ message: 'Login successful', user: userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
});

// Google OAuth sign-in / sign-up
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential, role } = req.body;
    if (!credential) return res.status(400).json({ message: 'Google credential required' });

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    let payload: any;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    const { email, given_name, family_name, name, picture } = payload;
    const userSelect = {
      id: true, email: true, username: true, firstName: true, lastName: true,
      role: true, staffId: true, avatar: true, organizationId: true,
      staff: { select: { id: true, name: true, staffType: true, gender: true } },
    };

    let user = await prisma.user.findUnique({ where: { email }, select: userSelect });
    let isNew = false;

    if (!user) {
      isNew = true;
      const base = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
      let username = base;
      const taken = await prisma.user.findUnique({ where: { username } });
      if (taken) username = base + crypto.randomBytes(3).toString('hex');

      const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      const googleFirstName = given_name || name?.split(' ')[0] || '';
      user = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: `${googleFirstName}'s Organisation`, updatedAt: new Date() }
        });
        return tx.user.create({
          data: {
            email,
            username,
            password: hashedPassword,
            firstName: googleFirstName,
            lastName: family_name || name?.split(' ').slice(1).join(' ') || '',
            role: role || 'admin',
            avatar: picture || null,
            organizationId: org.id,
          },
          select: userSelect,
        });
      });
    }

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '8h' });
    res.json({ message: 'Authentication successful', user, token, isNew });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        role: true, staffId: true, organizationId: true,
        staff: { select: { id: true, name: true, staffType: true, gender: true } },
        bio: true, avatar: true, createdAt: true, updatedAt: true,
        _count: { select: { roleAssignments: true } }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compute onboarding state so frontend doesn't rely solely on localStorage
    const orgId = req.user!.organizationId;
    const [staffCount, ruleCount] = await Promise.all([
      prisma.staff.count({ where: { isActive: true, ...(orgId ? { organizationId: orgId } : {}) } }),
      prisma.rule.count({ where: orgId ? { organizationId: orgId } : {} }),
    ]);

    res.json({
      user: {
        ...user,
        onboardingState: {
          hasStaff: staffCount > 0,
          hasRules: ruleCount > 0,
          isComplete: staffCount > 0 && ruleCount > 0,
        },
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Change password
router.patch('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, password: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// GET all users — admin/manager only
router.get('/users', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin' && req.user!.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        role: true, staffId: true,
        staff: { select: { id: true, name: true, staffType: true } },
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: { users } });
  } catch (error) {
    console.error('GET /auth/users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// PATCH change user role — admin only
router.patch('/users/:userId/role', authenticateToken, [
  body('role').isIn(['admin', 'manager', 'staff'])
], async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can change roles' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { userId } = req.params;
    const { role } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, username: true, firstName: true, lastName: true, role: true, staffId: true }
    });
    res.json({ success: true, message: 'Role updated', data: { user: updatedUser } });
  } catch (error) {
    console.error('PATCH /auth/users/:userId/role error:', error);
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
});

// PATCH link user to staff record — admin/manager only
router.patch('/users/:userId/link-staff', authenticateToken, [
  body('staffId').optional({ nullable: true })
], async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin' && req.user!.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    const { userId } = req.params;
    const { staffId } = req.body; // null to unlink

    // If linking, ensure staff record exists and isn't already linked to another user
    if (staffId) {
      const staff = await prisma.staff.findUnique({ where: { id: staffId } });
      if (!staff) return res.status(404).json({ success: false, message: 'Staff record not found' });
      const existingLink = await prisma.user.findFirst({ where: { staffId, NOT: { id: userId } } });
      if (existingLink) return res.status(409).json({ success: false, message: 'Staff record already linked to another user' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { staffId: staffId || null },
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        role: true, staffId: true,
        staff: { select: { id: true, name: true, staffType: true } }
      }
    });
    res.json({ success: true, message: 'User updated', data: { user: updatedUser } });
  } catch (error) {
    console.error('PATCH /auth/users/:userId/link-staff error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Update current user profile
router.put('/me', [
  authenticateToken,
  body('firstName').optional().notEmpty(),
  body('lastName').optional().notEmpty(),
  body('bio').optional().isLength({ max: 500 })
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, bio } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(bio !== undefined && { bio })
      },
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        role: true, bio: true, avatar: true, createdAt: true, updatedAt: true,
        staffId: true,
        staff: { select: { id: true, name: true, staffType: true, gender: true } }
      }
    });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});

export default router;
