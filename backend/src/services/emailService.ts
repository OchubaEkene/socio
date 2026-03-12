import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import { format, addDays, startOfWeek } from 'date-fns';

// Check if email credentials are configured
const isEmailConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

// Email configuration
const transporter = isEmailConfigured 
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : nodemailer.createTransport({
      // Test configuration that doesn't actually send emails
      host: 'localhost',
      port: 1025,
      ignoreTLS: true,
    });

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface StaffShift {
  staffId: string;
  staffName: string;
  staffEmail: string;
  shifts: Array<{
    date: Date;
    shiftType: 'day' | 'night';
    startTime: Date;
    endTime: Date;
  }>;
}

/**
 * Send availability reminder email to temporary staff
 * This function sends a weekly reminder to temporary staff to submit their availability
 */
export async function sendAvailabilityReminderEmails(): Promise<void> {
  try {
    console.log('📧 Sending availability reminder emails...');

    // Get all temporary staff
    const temporaryStaff = await prisma.staff.findMany({
      where: {
        staffType: 'temporary'
      },
      orderBy: {
        name: 'asc'
      }
    });

    if (temporaryStaff.length === 0) {
      console.log('No temporary staff found to send reminders to');
      return;
    }

    // Calculate next week's date range
    const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
    const nextWeekEnd = addDays(nextWeekStart, 6);

    const emailPromises = temporaryStaff.map(async (staff) => {
      const emailOptions: EmailOptions = {
        to: staff.email || 'staff@example.com', // Fallback email for demo
        subject: 'Weekly Availability Reminder - Submit Your Schedule',
        html: generateAvailabilityReminderEmail(staff.name, nextWeekStart, nextWeekEnd)
      };

      try {
        await sendEmail(emailOptions);
        console.log(`✅ Sent availability reminder to ${staff.name}`);
        return { success: true, staffName: staff.name };
      } catch (error) {
        console.error(`❌ Failed to send reminder to ${staff.name}:`, error);
        return { success: false, staffName: staff.name, error };
      }
    });

    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    
    const failed = results.length - successful;
    
    console.log(`📊 Availability reminders sent: ${successful} successful, ${failed} failed`);
  } catch (error) {
    console.error('❌ Error sending availability reminder emails:', error);
    throw error;
  }
}

/**
 * Send schedule summary emails to all staff
 * This function sends a summary of the upcoming week's schedule to each staff member
 */
export async function sendScheduleSummaryEmails(): Promise<void> {
  try {
    console.log('📧 Sending schedule summary emails...');

    // Get next week's schedule
    const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
    const nextWeekEnd = addDays(nextWeekStart, 6);

    // Get all shifts for next week
    const shifts = await prisma.shift.findMany({
      where: {
        date: {
          gte: nextWeekStart,
          lte: nextWeekEnd
        }
      },
      include: {
        staff: true
      },
      orderBy: [
        { staff: { name: 'asc' } },
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    });

    if (shifts.length === 0) {
      console.log('No shifts found for next week');
      return;
    }

    // Group shifts by staff member
    const staffShifts = new Map<string, StaffShift>();
    
    shifts.forEach(shift => {
      if (!staffShifts.has(shift.staffId)) {
        staffShifts.set(shift.staffId, {
          staffId: shift.staffId,
          staffName: shift.staff.name,
          staffEmail: shift.staff.email || 'staff@example.com',
          shifts: []
        });
      }
      
      staffShifts.get(shift.staffId)!.shifts.push({
        date: shift.date,
        shiftType: shift.shiftType,
        startTime: shift.startTime,
        endTime: shift.endTime
      });
    });

    // Send emails to each staff member
    const emailPromises = Array.from(staffShifts.values()).map(async (staffShift) => {
      const emailOptions: EmailOptions = {
        to: staffShift.staffEmail,
        subject: 'Your Weekly Schedule - Upcoming Week',
        html: generateScheduleSummaryEmail(staffShift, nextWeekStart, nextWeekEnd)
      };

      try {
        await sendEmail(emailOptions);
        console.log(`✅ Sent schedule summary to ${staffShift.staffName}`);
        return { success: true, staffName: staffShift.staffName };
      } catch (error) {
        console.error(`❌ Failed to send schedule to ${staffShift.staffName}:`, error);
        return { success: false, staffName: staffShift.staffName, error };
      }
    });

    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    
    const failed = results.length - successful;
    
    console.log(`📊 Schedule summaries sent: ${successful} successful, ${failed} failed`);
  } catch (error) {
    console.error('❌ Error sending schedule summary emails:', error);
    throw error;
  }
}

/**
 * Send a single email using the configured transporter
 */
async function sendEmail(options: EmailOptions): Promise<void> {
  if (!isEmailConfigured) {
    // In test mode, just log the email instead of sending it
    console.log('📧 [TEST MODE] Email would be sent:');
    console.log('   To:', options.to);
    console.log('   Subject:', options.subject);
    console.log('   Content length:', options.html.length, 'characters');
    return;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    ...options
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Generate HTML content for availability reminder email
 */
function generateAvailabilityReminderEmail(
  staffName: string, 
  weekStart: Date, 
  weekEnd: Date
): string {
  const weekStartFormatted = format(weekStart, 'MMMM d, yyyy');
  const weekEndFormatted = format(weekEnd, 'MMMM d, yyyy');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Weekly Availability Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Weekly Availability Reminder</h1>
        </div>
        <div class="content">
          <h2>Hello ${staffName},</h2>
          <p>This is your weekly reminder to submit your availability for the upcoming week.</p>
          
          <h3>Week: ${weekStartFormatted} - ${weekEndFormatted}</h3>
          
          <p>Please log into the system and update your availability for next week. This helps us create an efficient schedule that works for everyone.</p>
          
          <p><strong>Deadline:</strong> Please submit your availability by Friday at 5:00 PM.</p>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/staff-availability" class="button">
            Submit Availability
          </a>
          
          <p>If you have any questions or need assistance, please contact the scheduling team.</p>
          
          <p>Thank you for your cooperation!</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from the Staff Scheduling System.</p>
          <p>If you have any questions, please contact your supervisor.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML content for schedule summary email
 */
function generateScheduleSummaryEmail(
  staffShift: StaffShift, 
  weekStart: Date, 
  weekEnd: Date
): string {
  const weekStartFormatted = format(weekStart, 'MMMM d, yyyy');
  const weekEndFormatted = format(weekEnd, 'MMMM d, yyyy');
  
  // Generate shift table rows
  const shiftRows = staffShift.shifts.map(shift => {
    const dateFormatted = format(shift.date, 'EEEE, MMMM d');
    const startTimeFormatted = format(shift.startTime, 'h:mm a');
    const endTimeFormatted = format(shift.endTime, 'h:mm a');
    const shiftTypeColor = shift.shiftType === 'day' ? '#3B82F6' : '#8B5CF6';
    
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${dateFormatted}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">
          <span style="background-color: ${shiftTypeColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            ${shift.shiftType.toUpperCase()}
          </span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${startTimeFormatted} - ${endTimeFormatted}</td>
      </tr>
    `;
  }).join('');

  const totalShifts = staffShift.shifts.length;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your Weekly Schedule</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .schedule-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .schedule-table th { background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: bold; }
        .schedule-table td { padding: 10px; border-bottom: 1px solid #ddd; }
        .summary { background-color: #e0f2fe; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Your Weekly Schedule</h1>
        </div>
        <div class="content">
          <h2>Hello ${staffShift.staffName},</h2>
          <p>Your schedule for the upcoming week has been finalized.</p>
          
          <h3>Week: ${weekStartFormatted} - ${weekEndFormatted}</h3>
          
          <div class="summary">
            <h4>📊 Summary</h4>
            <p><strong>Total Shifts:</strong> ${totalShifts}</p>
            <p><strong>Week Period:</strong> ${weekStartFormatted} to ${weekEndFormatted}</p>
          </div>
          
          ${totalShifts > 0 ? `
            <h4>📅 Your Shifts</h4>
            <table class="schedule-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift Type</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                ${shiftRows}
              </tbody>
            </table>
          ` : `
            <div class="summary">
              <p><strong>No shifts assigned for this week.</strong></p>
              <p>If you believe this is an error, please contact the scheduling team.</p>
            </div>
          `}
          
          <p><strong>Important Notes:</strong></p>
          <ul>
            <li>Please arrive 10 minutes before your shift start time</li>
            <li>If you need to request time off, please do so at least 48 hours in advance</li>
            <li>Contact your supervisor if you have any questions about your schedule</li>
          </ul>
          
          <p>Thank you for your hard work!</p>
        </div>
        <div class="footer">
          <p>This schedule was automatically generated by the Staff Scheduling System.</p>
          <p>For questions or changes, please contact your supervisor.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send approval/rejection notification to a staff member
 */
export async function sendApprovalNotification(opts: {
  staffEmail: string;
  staffName: string;
  requestType: 'absence' | 'vacation' | 'shift_swap';
  status: 'APPROVED' | 'REJECTED';
  detail?: string;
}): Promise<void> {
  const { staffEmail, staffName, requestType, status, detail } = opts;
  const typeLabel = requestType === 'shift_swap' ? 'Shift Swap' : requestType === 'vacation' ? 'Vacation Request' : 'Absence Request';
  const statusLabel = status === 'APPROVED' ? '✅ Approved' : '❌ Rejected';
  const subject = `Your ${typeLabel} has been ${status === 'APPROVED' ? 'approved' : 'rejected'}`;

  const html = `
    <!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
      <h2 style="color:${status === 'APPROVED' ? '#16a34a' : '#dc2626'}">${statusLabel}: ${typeLabel}</h2>
      <p>Hi ${staffName},</p>
      <p>Your <strong>${typeLabel}</strong> has been <strong>${status === 'APPROVED' ? 'approved' : 'rejected'}</strong>.</p>
      ${detail ? `<p style="background:#f3f4f6;border-radius:8px;padding:12px">${detail}</p>` : ''}
      <p>Log in to the scheduling system for more details.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:32px">This is an automated notification from the Staff Scheduling System.</p>
    </body></html>
  `;

  try {
    await sendEmail({ to: staffEmail, subject, html });
    console.log(`✅ Sent ${requestType} ${status} notification to ${staffName}`);
  } catch (error) {
    console.error(`❌ Failed to send notification to ${staffName}:`, error);
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<boolean> {
  if (!isEmailConfigured) {
    console.log('📧 Email configuration: Test mode (no actual emails will be sent)');
    return true; // Return true for test mode
  }

  try {
    await transporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ Email configuration error:', error);
    return false;
  }
}
