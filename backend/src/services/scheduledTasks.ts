import cron from 'node-cron';
import { generateSchedule } from './schedulingService';
import { 
  sendAvailabilityReminderEmails, 
  sendScheduleSummaryEmails,
  testEmailConfiguration 
} from './emailService';
import { addDays, startOfWeek, format } from 'date-fns';

/**
 * Initialize all scheduled tasks
 * This function sets up cron jobs that run automatically
 */
export function initializeScheduledTasks(): void {
  console.log('🕐 Initializing scheduled tasks...');

  // Test email configuration on startup
  testEmailConfiguration().then(isValid => {
    if (!isValid) {
      console.warn('⚠️ Email configuration is invalid. Scheduled emails may fail.');
    }
  });

  // Schedule task to run every Sunday at 9:00 AM
  // Cron format: '0 9 * * 0' = Sunday at 9:00 AM
  cron.schedule('0 9 * * 0', async () => {
    console.log('🔄 Starting Sunday scheduled tasks...');
    await runWeeklyScheduledTasks();
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC'
  });

  console.log('✅ Scheduled tasks initialized');
  console.log('📅 Next run: Sunday at 9:00 AM');
}

/**
 * Run the complete weekly scheduled task workflow
 * This function executes all the tasks that need to happen every Sunday
 */
export async function runWeeklyScheduledTasks(): Promise<void> {
  const startTime = new Date();
  console.log(`🚀 Starting weekly scheduled tasks at ${startTime.toISOString()}`);

  try {
    // Step 1: Send availability reminder emails to temporary staff
    console.log('\n📧 Step 1: Sending availability reminder emails...');
    await sendAvailabilityReminderEmails();
    console.log('✅ Availability reminder emails completed');

    // Step 2: Generate schedule for next week
    console.log('\n📅 Step 2: Generating next week\'s schedule...');
    const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
    const scheduleResult = await generateSchedule(nextWeekStart);
    
    console.log(`✅ Schedule generation completed:`);
    console.log(`   - Generated ${scheduleResult.shifts.length} shifts`);
    console.log(`   - Found ${scheduleResult.exceptions.length} exceptions`);
    console.log(`   - Week: ${format(scheduleResult.summary.weekStart, 'MMM d')} - ${format(scheduleResult.summary.weekEnd, 'MMM d, yyyy')}`);

    // Log any scheduling exceptions
    if (scheduleResult.exceptions.length > 0) {
      console.log('\n⚠️ Scheduling Exceptions:');
      scheduleResult.exceptions.forEach((exception, index) => {
        console.log(`   ${index + 1}. ${exception.ruleName} (${exception.dayOfWeek} ${exception.shiftType})`);
        console.log(`      Required: ${exception.requiredStaff}, Assigned: ${exception.assignedStaff}`);
        console.log(`      Message: ${exception.message}`);
      });
    }

    // Step 3: Send schedule summary emails to all staff
    console.log('\n📧 Step 3: Sending schedule summary emails...');
    await sendScheduleSummaryEmails();
    console.log('✅ Schedule summary emails completed');

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    console.log(`\n🎉 Weekly scheduled tasks completed successfully!`);
    console.log(`⏱️ Total duration: ${duration}ms`);
    console.log(`📊 Summary:`);
    console.log(`   - Availability reminders sent`);
    console.log(`   - ${scheduleResult.shifts.length} shifts generated`);
    console.log(`   - ${scheduleResult.exceptions.length} exceptions logged`);
    console.log(`   - Schedule summaries sent`);

  } catch (error) {
    console.error('❌ Error in weekly scheduled tasks:', error);
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
    
    // You might want to send an alert email to administrators here
    // await sendAdminAlertEmail(error);
  }
}

/**
 * Manual trigger for weekly tasks (for testing or manual execution)
 * This function can be called manually to run the weekly tasks immediately
 */
export async function triggerWeeklyTasks(): Promise<void> {
  console.log('🔧 Manually triggering weekly tasks...');
  await runWeeklyScheduledTasks();
}

/**
 * Test the scheduled tasks without actually sending emails
 * This is useful for development and testing
 */
export async function testScheduledTasks(): Promise<void> {
  console.log('🧪 Testing scheduled tasks (dry run)...');
  
  try {
    // Test email configuration
    const emailConfigValid = await testEmailConfiguration();
    console.log(`Email configuration: ${emailConfigValid ? '✅ Valid' : '❌ Invalid'}`);
    
    // Test schedule generation (without saving to database)
    const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
    console.log(`Would generate schedule for week starting: ${format(nextWeekStart, 'MMM d, yyyy')}`);
    
    console.log('✅ Scheduled tasks test completed');
  } catch (error) {
    console.error('❌ Error testing scheduled tasks:', error);
  }
}

/**
 * Get information about the next scheduled run
 */
export function getNextScheduledRun(): Date {
  // Calculate next Sunday at 9:00 AM
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(9, 0, 0, 0);
  
  // If it's already Sunday and past 9 AM, get next Sunday
  if (now.getDay() === 0 && now.getHours() >= 9) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }
  
  return nextSunday;
}

/**
 * Get status of scheduled tasks
 */
export function getScheduledTasksStatus(): {
  isInitialized: boolean;
  nextRun: Date;
  isEmailConfigured: boolean;
} {
  return {
    isInitialized: true, // This would be set based on actual initialization
    nextRun: getNextScheduledRun(),
    isEmailConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS)
  };
}
