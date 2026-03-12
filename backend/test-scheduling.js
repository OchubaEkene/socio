const { PrismaClient } = require('@prisma/client');
const { generateSchedule } = require('./src/services/schedulingService');

const prisma = new PrismaClient();

async function testScheduling() {
  try {
    console.log('🧪 Testing Schedule Generation...\n');

    // 1. Create some test staff
    console.log('1. Creating test staff...');
    const staff1 = await prisma.staff.create({
      data: {
        name: 'John Doe',
        gender: 'male',
        staffType: 'permanent'
      }
    });
    console.log('   ✅ Created permanent staff:', staff1.name);

    const staff2 = await prisma.staff.create({
      data: {
        name: 'Jane Smith',
        gender: 'female',
        staffType: 'temporary'
      }
    });
    console.log('   ✅ Created temporary staff:', staff2.name);

    const staff3 = await prisma.staff.create({
      data: {
        name: 'Bob Wilson',
        gender: 'male',
        staffType: 'temporary'
      }
    });
    console.log('   ✅ Created temporary staff:', staff3.name);

    // 2. Create availability for temporary staff
    console.log('\n2. Creating availability...');
    const weekStart = new Date('2024-01-15'); // Monday
    const weekEnd = new Date('2024-01-21'); // Sunday

    // Jane's availability (Monday to Friday, 8 AM - 6 PM)
    for (let i = 0; i < 5; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      
      await prisma.availability.create({
        data: {
          staffId: staff2.id,
          startTime: new Date(date.setHours(8, 0, 0, 0)),
          endTime: new Date(date.setHours(18, 0, 0, 0))
        }
      });
    }
    console.log('   ✅ Created availability for Jane (Mon-Fri, 8 AM - 6 PM)');

    // Bob's availability (Monday to Wednesday, 8 AM - 8 PM)
    for (let i = 0; i < 3; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      
      await prisma.availability.create({
        data: {
          staffId: staff3.id,
          startTime: new Date(date.setHours(8, 0, 0, 0)),
          endTime: new Date(date.setHours(20, 0, 0, 0))
        }
      });
    }
    console.log('   ✅ Created availability for Bob (Mon-Wed, 8 AM - 8 PM)');

    // 3. Create some rules
    console.log('\n3. Creating staffing rules...');
    
    const rule1 = await prisma.rule.create({
      data: {
        name: 'Day Shift - Monday',
        shiftType: 'day',
        dayOfWeek: 'monday',
        requiredStaff: 2,
        genderPreference: 'any',
        priority: 1
      }
    });
    console.log('   ✅ Created rule:', rule1.name);

    const rule2 = await prisma.rule.create({
      data: {
        name: 'Night Shift - Monday',
        shiftType: 'night',
        dayOfWeek: 'monday',
        requiredStaff: 1,
        genderPreference: 'male',
        priority: 2
      }
    });
    console.log('   ✅ Created rule:', rule2.name);

    const rule3 = await prisma.rule.create({
      data: {
        name: 'Day Shift - Tuesday',
        shiftType: 'day',
        dayOfWeek: 'tuesday',
        requiredStaff: 3,
        genderPreference: 'any',
        priority: 1
      }
    });
    console.log('   ✅ Created rule:', rule3.name);

    // 4. Generate schedule
    console.log('\n4. Generating schedule...');
    const result = await generateSchedule('2024-01-15');
    
    console.log('\n📅 Schedule Generation Results:');
    console.log('================================');
    console.log(`Total Shifts Generated: ${result.summary.totalShifts}`);
    console.log(`Total Exceptions: ${result.summary.totalExceptions}`);
    console.log(`Week: ${result.summary.weekStart.toDateString()} - ${result.summary.weekEnd.toDateString()}`);
    
    if (result.shifts.length > 0) {
      console.log('\n📋 Generated Shifts:');
      result.shifts.forEach((shift, index) => {
        console.log(`   ${index + 1}. ${shift.staffName} - ${shift.shiftType} shift on ${shift.date.toDateString()}`);
        console.log(`      Rule: ${shift.ruleName}`);
        console.log(`      Time: ${shift.startTime.toLocaleTimeString()} - ${shift.endTime.toLocaleTimeString()}`);
      });
    }
    
    if (result.exceptions.length > 0) {
      console.log('\n⚠️  Scheduling Exceptions:');
      result.exceptions.forEach((exception, index) => {
        console.log(`   ${index + 1}. ${exception.ruleName} (${exception.dayOfWeek} ${exception.shiftType})`);
        console.log(`      Required: ${exception.requiredStaff}, Assigned: ${exception.assignedStaff}`);
        console.log(`      Available: ${exception.availableStaff}, Gender: ${exception.genderPreference}`);
        console.log(`      Message: ${exception.message}`);
        console.log(`      Severity: ${exception.severity}`);
      });
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testScheduling();
