import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { differenceInHours, parseISO } from 'date-fns';

const router = Router();

// GET all working time accounts (with filtering)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { staffId, accountType, year, month, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    const orgId = req.user!.organizationId;

    const whereClause: any = { isActive: true, organizationId: orgId };
    
    if (staffId) {
      whereClause.staffId = staffId;
    }
    
    if (accountType) {
      whereClause.accountType = accountType;
    }
    
    if (year) {
      whereClause.year = parseInt(year as string);
    }
    
    if (month) {
      whereClause.month = parseInt(month as string);
    }

    const accounts = await prisma.workingTimeAccount.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        transactions: {
          orderBy: { recordedAt: 'desc' },
          take: 10 // Get last 10 transactions
        }
      },
      skip,
      take: limitNum,
      orderBy: [
        { staff: { name: 'asc' } },
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    const total = await prisma.workingTimeAccount.count({
      where: whereClause
    });

    res.json({
      success: true,
      data: {
        accounts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('GET /api/working-time-accounts error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get working time accounts' 
    });
  }
});

// GET working time account by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.workingTimeAccount.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        transactions: {
          orderBy: { recordedAt: 'desc' }
        }
      }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Working time account not found'
      });
    }

    res.json({
      success: true,
      data: { account }
    });
  } catch (error) {
    console.error('GET /api/working-time-accounts/:id error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get working time account' 
    });
  }
});

// GET transactions for a specific account
router.get('/:id/transactions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    const orgId = (req as any).user?.organizationId;

    const account = await prisma.workingTimeAccount.findFirst({ where: { id, organizationId: orgId } });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const transactions = await prisma.workingTimeTransaction.findMany({
      where: { accountId: id },
      include: {
        recorder: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      skip,
      take: limitNum,
      orderBy: { recordedAt: 'desc' }
    });

    const total = await prisma.workingTimeTransaction.count({
      where: { accountId: id }
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('GET /api/working-time-accounts/:id/transactions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get transactions' 
    });
  }
});

// POST create new working time account
router.post('/', authenticateToken, [
  body('staffId').isString().notEmpty().withMessage('Staff ID is required'),
  body('accountType').isIn(['OVERTIME', 'FLEX_TIME', 'COMP_TIME', 'VACATION_ACCOUNT', 'SICK_LEAVE_ACCOUNT']).withMessage('Invalid account type'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030'),
  body('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('maxBalance').optional().isFloat({ min: 0 }).withMessage('Max balance must be a positive number'),
  body('minBalance').optional().isFloat({ max: 0 }).withMessage('Min balance must be a negative number or zero')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { staffId, accountType, year, month, maxBalance, minBalance } = req.body;
    const orgId = req.user!.organizationId;

    // Check if staff exists
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: orgId }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check if account already exists for this staff, type, year, and month
    const existingAccount = await prisma.workingTimeAccount.findFirst({
      where: {
        staffId,
        accountType,
        year,
        month: month || null,
        organizationId: orgId
      }
    });

    if (existingAccount) {
      return res.status(409).json({
        success: false,
        message: 'Working time account already exists for this staff member, type, and period'
      });
    }

    const account = await prisma.workingTimeAccount.create({
      data: {
        staffId,
        accountType,
        year,
        month: month || null,
        maxBalance,
        minBalance,
        organizationId: orgId,
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Working time account created successfully',
      data: { account }
    });
  } catch (error) {
    console.error('POST /api/working-time-accounts error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create working time account' 
    });
  }
});

// POST add transaction to working time account
router.post('/:id/transactions', authenticateToken, [
  body('transactionType').isIn(['CREDIT', 'DEBIT']).withMessage('Transaction type must be CREDIT or DEBIT'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('description').isString().notEmpty().withMessage('Description is required'),
  body('referenceType').optional().isString(),
  body('referenceId').optional().isString(),
  body('method').optional().isIn(['MANUAL', 'AUTOMATIC', 'SHYFTPLAN', 'SAP_INTEGRATION', 'API_INTEGRATION']),
  body('notes').optional().isString()
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { transactionType, amount, description, referenceType, referenceId, method = 'MANUAL', notes } = req.body;
    const recordedBy = req.user!.id;

    // Check if account exists
    const account = await prisma.workingTimeAccount.findUnique({
      where: { id }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Working time account not found'
      });
    }

    // Calculate new balance
    const newBalance = transactionType === 'CREDIT' 
      ? account.balance + amount 
      : account.balance - amount;

    // Check balance limits
    if (account.maxBalance && newBalance > account.maxBalance) {
      return res.status(400).json({
        success: false,
        message: `Transaction would exceed maximum balance of ${account.maxBalance} hours`
      });
    }

    if (account.minBalance && newBalance < account.minBalance) {
      return res.status(400).json({
        success: false,
        message: `Transaction would exceed minimum balance of ${account.minBalance} hours`
      });
    }

    // Create transaction and update account balance in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.workingTimeTransaction.create({
        data: {
          accountId: id,
          transactionType,
          amount,
          description,
          referenceType,
          referenceId,
          recordedBy,
          method,
          notes
        },
        include: {
          recorder: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      const updatedAccount = await tx.workingTimeAccount.update({
        where: { id },
        data: { balance: newBalance },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      return { transaction, account: updatedAccount };
    });

    res.status(201).json({
      success: true,
      message: 'Transaction added successfully',
      data: result
    });
  } catch (error) {
    console.error('POST /api/working-time-accounts/:id/transactions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add transaction' 
    });
  }
});

// POST calculate time from shift (automatic transaction)
router.post('/:id/calculate-from-shift', authenticateToken, [
  body('shiftId').isString().notEmpty().withMessage('Shift ID is required')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { shiftId } = req.body;
    const recordedBy = req.user!.id;

    // Check if account exists
    const account = await prisma.workingTimeAccount.findUnique({
      where: { id },
      include: {
        staff: true
      }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Working time account not found'
      });
    }

    // Get shift details
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    });

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Verify shift belongs to the account owner
    if (shift.staffId !== account.staffId) {
      return res.status(403).json({
        success: false,
        message: 'Shift does not belong to the account owner'
      });
    }

    // Calculate hours worked
    const hoursWorked = differenceInHours(shift.endTime, shift.startTime);
    
    // Determine transaction type based on account type
    let transactionType: 'CREDIT' | 'DEBIT' = 'CREDIT';
    let description = `Hours worked on ${shift.shiftType} shift`;

    if (account.accountType === 'OVERTIME') {
      // For overtime account, only credit if hours exceed standard shift
      const standardShiftHours = 8; // Assuming 8-hour standard shift
      if (hoursWorked <= standardShiftHours) {
        return res.status(400).json({
          success: false,
          message: 'No overtime hours to record for this shift'
        });
      }
      const overtimeHours = hoursWorked - standardShiftHours;
      description = `${overtimeHours} overtime hours from ${shift.shiftType} shift`;
      
      // Create transaction with overtime hours
      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.workingTimeTransaction.create({
          data: {
            accountId: id,
            transactionType: 'CREDIT',
            amount: overtimeHours,
            description,
            referenceType: 'SHIFT',
            referenceId: shiftId,
            recordedBy,
            method: 'AUTOMATIC',
            notes: `Calculated from shift ${shiftId}`
          }
        });

        const updatedAccount = await tx.workingTimeAccount.update({
          where: { id },
          data: { balance: account.balance + overtimeHours }
        });

        return { transaction, account: updatedAccount };
      });

      res.status(201).json({
        success: true,
        message: 'Overtime hours calculated and recorded successfully',
        data: result
      });
    } else {
      // For other account types, record the full hours
      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.workingTimeTransaction.create({
          data: {
            accountId: id,
            transactionType: 'CREDIT',
            amount: hoursWorked,
            description,
            referenceType: 'SHIFT',
            referenceId: shiftId,
            recordedBy,
            method: 'AUTOMATIC',
            notes: `Calculated from shift ${shiftId}`
          }
        });

        const updatedAccount = await tx.workingTimeAccount.update({
          where: { id },
          data: { balance: account.balance + hoursWorked }
        });

        return { transaction, account: updatedAccount };
      });

      res.status(201).json({
        success: true,
        message: 'Hours calculated and recorded successfully',
        data: result
      });
    }
  } catch (error) {
    console.error('POST /api/working-time-accounts/:id/calculate-from-shift error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to calculate hours from shift' 
    });
  }
});

// GET summary for all accounts of a staff member
router.get('/staff/:staffId/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const { year } = req.query;
    const orgId = (req as any).user?.organizationId;

    const whereClause: any = {
      staffId,
      isActive: true,
      organizationId: orgId
    };

    if (year) {
      whereClause.year = parseInt(year as string);
    }

    const accounts = await prisma.workingTimeAccount.findMany({
      where: whereClause,
      include: {
        transactions: {
          orderBy: { recordedAt: 'desc' },
          take: 5 // Get last 5 transactions per account
        }
      },
      orderBy: [
        { accountType: 'asc' },
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    // Calculate summary
    const summary = {
      totalAccounts: accounts.length,
      totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
      accountsByType: accounts.reduce((acc, account) => {
        if (!acc[account.accountType]) {
          acc[account.accountType] = {
            count: 0,
            totalBalance: 0,
            accounts: []
          };
        }
        acc[account.accountType].count++;
        acc[account.accountType].totalBalance += account.balance;
        acc[account.accountType].accounts.push(account);
        return acc;
      }, {} as any)
    };

    res.json({
      success: true,
      data: { accounts, summary }
    });
  } catch (error) {
    console.error('GET /api/working-time-accounts/staff/:staffId/summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get account summary' 
    });
  }
});

export default router;
