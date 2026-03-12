import { Router, Request, Response } from 'express';
import { 
  triggerWeeklyTasks, 
  testScheduledTasks, 
  getScheduledTasksStatus 
} from '../services/scheduledTasks';
import { sendAvailabilityReminderEmails, sendScheduleSummaryEmails } from '../services/emailService';

const router = Router();

// POST trigger weekly tasks manually
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    console.log('🔧 Manual trigger of weekly tasks requested');
    
    // Start the task in the background to avoid blocking the response
    triggerWeeklyTasks().catch(error => {
      console.error('❌ Error in manual weekly tasks:', error);
    });

    res.json({
      success: true,
      message: 'Weekly tasks triggered successfully. Check server logs for progress.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('POST /api/scheduled-tasks/trigger error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to trigger weekly tasks',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST test scheduled tasks (dry run)
router.post('/test', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Testing scheduled tasks requested');
    
    await testScheduledTasks();

    res.json({
      success: true,
      message: 'Scheduled tasks test completed successfully. Check server logs for details.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('POST /api/scheduled-tasks/test error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to test scheduled tasks',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET scheduled tasks status
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = getScheduledTasksStatus();

    res.json({
      success: true,
      data: {
        ...status,
        nextRun: status.nextRun.toISOString(),
        currentTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('GET /api/scheduled-tasks/status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get scheduled tasks status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST test email functionality
router.post('/test-emails', async (req: Request, res: Response) => {
  try {
    console.log('📧 Testing email functionality...');
    
    // Test availability reminder emails
    console.log('Testing availability reminder emails...');
    await sendAvailabilityReminderEmails();
    
    // Test schedule summary emails
    console.log('Testing schedule summary emails...');
    await sendScheduleSummaryEmails();
    
    res.json({
      success: true,
      message: 'Email tests completed successfully. Check server logs for details.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('POST /api/scheduled-tasks/test-emails error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to test emails',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
