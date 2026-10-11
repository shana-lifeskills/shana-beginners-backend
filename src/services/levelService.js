const { levelIndexOf, LEVEL_ORDER } = require('../config/levelOrder');
const { CurriculumModule, StudentModuleProgress } = require('../models');

/**
 * Standalone (not folded into studentProgressService.js or paymentService.js)
 * so both can depend on it without creating a circular require between those
 * two services — studentProgressService.assertPaidFor delegates to
 * paymentService.getUnlockedModuleIds, and paymentService needs this module's
 * isLevelUnlocked to validate bundle purchases.
 */

/**
 * Duolingo-style sequencing: a module in Level N is only reachable once every
 * (active, same-ageGroup) module in Level N-1 is fully completed — independent
 * of payment, so a student who already paid for a later Level still has to
 * finish the one before it first. Untracked modules and Level 1 (index 0) are
 * always unlocked.
 */
async function isLevelUnlocked(userId, mod) {
  const levelIndex = levelIndexOf(mod.trackName);
  if (levelIndex <= 0) return true;

  const previousLevelTrackName = LEVEL_ORDER[levelIndex - 1];
  const previousLevelModules = await CurriculumModule.findAll({
    where: {
      trackName: previousLevelTrackName,
      ageGroup: mod.ageGroup,
      category: 'life-skills',
      archivedAt: null,
    },
    attributes: ['id'],
  });
  if (previousLevelModules.length === 0) return true;

  const previousLevelModuleIds = previousLevelModules.map((m) => m.id);
  const completedCount = await StudentModuleProgress.count({
    where: { userId, moduleId: previousLevelModuleIds, status: 'completed' },
  });
  return completedCount >= previousLevelModuleIds.length;
}

module.exports = { isLevelUnlocked, levelIndexOf, LEVEL_ORDER };
