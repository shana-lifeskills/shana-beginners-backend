const { User, PaymentReminderLog } = require('../models');
const { sendPaymentReminderEmail } = require('./emailService');

// How many days out from month-end the reminder window opens — a student
// who still hasn't paid gets emailed once per month, any time from this many
// days before the month's last day through the last day itself.
const REMINDER_WINDOW_DAYS = 7;

function monthKeyFor(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Days remaining in `date`'s calendar month, counting `date` itself as day 0
 *  (i.e. 0 on the last day of the month, 1 the day before, etc). */
function daysUntilMonthEnd(date) {
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startOfToday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((lastDayOfMonth - startOfToday) / msPerDay);
}

class PaymentReminderService {
  /**
   * Runs the month-end payment-reminder check: if today falls within
   * REMINDER_WINDOW_DAYS of the month's last day, emails every student whose
   * `hasPaid` is still false and who hasn't already been reminded this
   * calendar month. Safe to call more than once a day — already-reminded
   * students are skipped via PaymentReminderLog's unique (studentId, month)
   * index, not re-emailed.
   */
  async sendMonthEndPaymentReminders(now = new Date()) {
    const daysLeft = daysUntilMonthEnd(now);
    if (daysLeft < 0 || daysLeft > REMINDER_WINDOW_DAYS) {
      return { inWindow: false, daysUntilMonthEnd: daysLeft, sent: 0, skipped: 0 };
    }

    const monthKey = monthKeyFor(now);
    const unpaidStudents = await User.findAll({ where: { role: 'student', hasPaid: false } });

    let sent = 0;
    let skipped = 0;

    for (const student of unpaidStudents) {
      const [, created] = await PaymentReminderLog.findOrCreate({
        where: { studentId: student.id, remindedForMonth: monthKey },
        defaults: { sentAt: now },
      });

      if (!created) {
        skipped += 1;
        continue;
      }

      await sendPaymentReminderEmail(student, { daysUntilMonthEnd: daysLeft });
      sent += 1;
    }

    return { inWindow: true, daysUntilMonthEnd: daysLeft, monthKey, unpaidStudentCount: unpaidStudents.length, sent, skipped };
  }
}

module.exports = new PaymentReminderService();
