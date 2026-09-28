const AGE_GROUPS = ['beginner', 'advanced'];
const AVATAR_IDS = ['nova', 'milo', 'zoe', 'kai', 'ruby', 'theo'];

/** The user shape every auth/users/students response returns. */
function toUserResponse(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    profileImage: user.profileImage ?? null,
    role: user.role,
    stars: user.stars,
    badges: user.badges,
    trophies: user.trophies,
    modulesCompleted: user.modulesCompleted,
    hasPaid: user.hasPaid,
    emailVerified: user.emailVerified,
    ageGroup: user.ageGroup,
    avatarId: user.avatarId ?? null,
    avatarUrl: user.avatarUrl ?? null,
    hasSeenWelcome: user.hasSeenWelcome,
    streakCount: user.streakCount,
    lastActiveDate: user.lastActiveDate ?? null,
    createdAt: user.createdAt,
  };
}

/**
 * Counts today as an active day: +1 if the last session was yesterday, reset to 1 if a
 * day was missed, unchanged if already counted today. Dates are UTC calendar days —
 * the same rule the frontend has always used. Called at each session start (login and
 * refresh), so the streak follows the student across devices.
 *
 * Never throws: a failed streak write must not block anyone from signing in.
 */
async function touchStreak(user) {
  const today = new Date().toISOString().slice(0, 10);
  if (user.lastActiveDate === today) return user;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streakCount = user.lastActiveDate === yesterday ? user.streakCount + 1 : 1;
  try {
    return await user.update({ streakCount, lastActiveDate: today });
  } catch (err) {
    console.error(`Could not update streak for user ${user.id}:`, err.message);
    return user;
  }
}

module.exports = { toUserResponse, touchStreak, AGE_GROUPS, AVATAR_IDS };
