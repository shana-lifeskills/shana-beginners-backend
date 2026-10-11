/**
 * The 8 curriculum tracks, in the sequence they unlock as "Levels" —
 * Duolingo-style: a module's Level is its `trackName`'s position here, and
 * Level N+1 stays locked until every Level N module is completed (see
 * services/levelService.js). This is a fixed business sequence, not
 * admin-editable content, so it's a plain constant rather than a DB column —
 * matches the current `seed-data.service.ts` first-appearance order.
 */
const LEVEL_ORDER = [
  'Personal Empowerment',
  'Communication',
  'Character Development',
  'Digital Responsibility',
  'Cognitive Skills',
  'Financial Responsibility',
  'Leadership Potential',
  'Health and Wellbeing',
];

/** Returns the 0-based Level index for a track name, or -1 for an
 *  untracked/unrecognized trackName (exempt from level-gating, same as
 *  game-category modules — see levelService.isLevelUnlocked). */
function levelIndexOf(trackName) {
  if (!trackName) return -1;
  return LEVEL_ORDER.indexOf(trackName);
}

module.exports = { LEVEL_ORDER, levelIndexOf };
