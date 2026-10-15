const { Op } = require('sequelize');
const { User, Message } = require('../models');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const STAFF_ROLES = ['instructor', 'admin'];

/** A student may only message staff, and staff may only message students — no student<->student or staff<->staff DMs. */
function assertAllowedPair(senderRole, recipientRole) {
  const senderIsStaff = STAFF_ROLES.includes(senderRole);
  const recipientIsStaff = STAFF_ROLES.includes(recipientRole);
  if (senderIsStaff === recipientIsStaff) {
    throw httpError(403, 'Messages are only allowed between a trainer and a student');
  }
}

/** Every user the current user has an open conversation with, newest message first, with an unread count. */
async function listConversations(currentUser) {
  const partnerRole = STAFF_ROLES.includes(currentUser.role) ? 'student' : { [Op.in]: STAFF_ROLES };

  const partners = await User.findAll({
    where: { role: partnerRole },
    attributes: ['id', 'firstName', 'lastName', 'profileImage', 'role'],
    order: [['firstName', 'ASC'], ['lastName', 'ASC']],
  });

  const results = await Promise.all(
    partners.map(async (partner) => {
      const lastMessage = await Message.findOne({
        where: {
          [Op.or]: [
            { senderId: currentUser.id, recipientId: partner.id },
            { senderId: partner.id, recipientId: currentUser.id },
          ],
        },
        order: [['createdAt', 'DESC']],
      });
      const unreadCount = await Message.count({
        where: { senderId: partner.id, recipientId: currentUser.id, readAt: null },
      });
      return {
        id: partner.id,
        firstName: partner.firstName,
        lastName: partner.lastName,
        profileImage: partner.profileImage ?? null,
        role: partner.role,
        lastMessage: lastMessage ? lastMessage.body : null,
        lastMessageAt: lastMessage ? lastMessage.createdAt : null,
        unreadCount,
      };
    })
  );

  // Conversations with activity float to the top; the rest stay alphabetical.
  return results.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    if (a.lastMessageAt) return -1;
    if (b.lastMessageAt) return 1;
    return 0;
  });
}

/** Every message between the current user and `otherUserId`, oldest first — optionally only ones after a given timestamp, for polling. */
async function getConversation(currentUser, otherUserId, { after } = {}) {
  const other = await User.findByPk(otherUserId, { attributes: ['id', 'role'] });
  if (!other) throw httpError(404, 'User not found');

  const where = {
    [Op.or]: [
      { senderId: currentUser.id, recipientId: otherUserId },
      { senderId: otherUserId, recipientId: currentUser.id },
    ],
  };
  if (after) where.createdAt = { [Op.gt]: new Date(after) };

  return Message.findAll({ where, order: [['createdAt', 'ASC']] });
}

async function sendMessage(currentUser, { recipientId, body }) {
  if (!recipientId || !body || !body.trim()) throw httpError(400, 'recipientId and body are required');

  const recipient = await User.findByPk(recipientId, { attributes: ['id', 'role'] });
  if (!recipient) throw httpError(404, 'Recipient not found');
  assertAllowedPair(currentUser.role, recipient.role);

  return Message.create({ senderId: currentUser.id, recipientId, body: body.trim() });
}

/** Marks every unread message FROM `otherUserId` TO the current user as read. */
async function markRead(currentUser, otherUserId) {
  await Message.update(
    { readAt: new Date() },
    { where: { senderId: otherUserId, recipientId: currentUser.id, readAt: null } }
  );
}

module.exports = { listConversations, getConversation, sendMessage, markRead };
