const { randomUUID } = require('crypto');
const { User, Meeting } = require('../models');

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Jitsi Meet needs no account/API key — any unique room name is an instant, free video room. */
function buildRoomUrl() {
  return `https://meet.jit.si/shana-${randomUUID()}`;
}

const WITH_PARTICIPANTS = {
  include: [
    { model: User, as: 'host', attributes: ['id', 'firstName', 'lastName'] },
    { model: User, as: 'student', attributes: ['id', 'firstName', 'lastName'] },
  ],
};

async function createMeeting(host, { studentId, title, scheduledAt }) {
  if (!studentId || !title || !scheduledAt) throw httpError(400, 'studentId, title and scheduledAt are required');

  const student = await User.findOne({ where: { id: studentId, role: 'student' }, attributes: ['id'] });
  if (!student) throw httpError(404, 'Student not found');

  const meeting = await Meeting.create({
    hostId: host.id,
    studentId,
    title,
    scheduledAt: new Date(scheduledAt),
    roomUrl: buildRoomUrl(),
  });
  return Meeting.findByPk(meeting.id, WITH_PARTICIPANTS);
}

/** Trainers/admins see meetings they host; students see meetings they're invited to. */
async function listMeetings(currentUser) {
  const where = ['instructor', 'admin'].includes(currentUser.role)
    ? { hostId: currentUser.id }
    : { studentId: currentUser.id };

  return Meeting.findAll({ where, order: [['scheduledAt', 'ASC']], ...WITH_PARTICIPANTS });
}

async function getMeeting(currentUser, id) {
  const meeting = await Meeting.findByPk(id, WITH_PARTICIPANTS);
  if (!meeting) throw httpError(404, 'Meeting not found');
  if (meeting.hostId !== currentUser.id && meeting.studentId !== currentUser.id) {
    throw httpError(403, 'Forbidden');
  }
  return meeting;
}

async function cancelMeeting(currentUser, id) {
  const meeting = await Meeting.findByPk(id);
  if (!meeting) throw httpError(404, 'Meeting not found');
  if (meeting.hostId !== currentUser.id) throw httpError(403, 'Forbidden');
  await meeting.update({ canceledAt: new Date() });
  return Meeting.findByPk(id, WITH_PARTICIPANTS);
}

module.exports = { createMeeting, listMeetings, getMeeting, cancelMeeting };
