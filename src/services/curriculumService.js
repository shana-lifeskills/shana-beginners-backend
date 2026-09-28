const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, CurriculumModule, CurriculumLesson, CurriculumExercise } = require('../models');

const CATEGORIES = ['life-skills', 'game'];
const AGE_GROUPS = ['beginner', 'advanced'];
const MAX_ID_LENGTH = 255;

function badRequest(message, details) {
  return Object.assign(new Error(message), { status: 400, details });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Key-sorted JSON, so the content hash doesn't change when key order does. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Checks a module in the frontend's `Module` shape. Returns a list of human-readable
 * problems (empty when valid) rather than throwing on the first, so an author sees
 * everything wrong with their content in one run.
 */
function validateModule(mod) {
  const errors = [];
  const where = isNonEmptyString(mod?.id) ? mod.id : '(module without id)';

  if (!mod || typeof mod !== 'object') return ['module must be an object'];
  if (!isNonEmptyString(mod.id)) errors.push('module.id is required');
  else if (mod.id.length > MAX_ID_LENGTH) errors.push(`${where}: id longer than ${MAX_ID_LENGTH} characters`);
  if (!isNonEmptyString(mod.title)) errors.push(`${where}: title is required`);
  if (!CATEGORIES.includes(mod.category)) errors.push(`${where}: category must be one of ${CATEGORIES.join(', ')}`);
  if (!AGE_GROUPS.includes(mod.ageGroup)) errors.push(`${where}: ageGroup must be one of ${AGE_GROUPS.join(', ')}`);
  if (mod.trackName !== undefined && mod.trackName !== null && typeof mod.trackName !== 'string') {
    errors.push(`${where}: trackName must be a string`);
  }
  if (!Array.isArray(mod.lessons)) {
    errors.push(`${where}: lessons must be an array`);
    return errors;
  }

  const lessonIds = new Set();
  const exerciseIds = new Set();
  mod.lessons.forEach((lesson, li) => {
    const lw = `${where} > lessons[${li}]${isNonEmptyString(lesson?.id) ? ` (${lesson.id})` : ''}`;
    if (!lesson || typeof lesson !== 'object') {
      errors.push(`${lw}: must be an object`);
      return;
    }
    if (!isNonEmptyString(lesson.id)) errors.push(`${lw}: id is required`);
    else if (lesson.id.length > MAX_ID_LENGTH) errors.push(`${lw}: id longer than ${MAX_ID_LENGTH} characters`);
    else if (lessonIds.has(lesson.id)) errors.push(`${lw}: duplicate lesson id "${lesson.id}"`);
    else lessonIds.add(lesson.id);
    if (!isNonEmptyString(lesson.title)) errors.push(`${lw}: title is required`);
    if (!Number.isInteger(lesson.order)) errors.push(`${lw}: order must be an integer`);
    if (!Number.isInteger(lesson.week)) errors.push(`${lw}: week must be an integer`);
    if (!Array.isArray(lesson.exercises)) {
      errors.push(`${lw}: exercises must be an array`);
      return;
    }
    lesson.exercises.forEach((exercise, ei) => {
      const ew = `${lw} > exercises[${ei}]${isNonEmptyString(exercise?.id) ? ` (${exercise.id})` : ''}`;
      if (!exercise || typeof exercise !== 'object') {
        errors.push(`${ew}: must be an object`);
        return;
      }
      if (!isNonEmptyString(exercise.id)) errors.push(`${ew}: id is required`);
      else if (exercise.id.length > MAX_ID_LENGTH) errors.push(`${ew}: id longer than ${MAX_ID_LENGTH} characters`);
      else if (exerciseIds.has(exercise.id)) errors.push(`${ew}: duplicate exercise id "${exercise.id}"`);
      else exerciseIds.add(exercise.id);
      if (!isNonEmptyString(exercise.type)) errors.push(`${ew}: type is required`);
      if (!Number.isInteger(exercise.order)) errors.push(`${ew}: order must be an integer`);
    });
  });

  return errors;
}

/**
 * The persisted content fields of a module — everything that, if changed, is a new
 * version. Display position (sortOrder) is deliberately not content: removing or
 * reordering one module must not bump the version of every module after it.
 */
function contentOf(mod) {
  return {
    title: mod.title,
    description: mod.description ?? '',
    icon: mod.icon ?? '',
    themeColor: mod.themeColor ?? '',
    category: mod.category,
    trackName: mod.trackName ?? null,
    ageGroup: mod.ageGroup,
    lessons: mod.lessons,
  };
}

function hashContent(content) {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(content)).digest('hex')}`;
}

/**
 * Rejects lesson/exercise ids already owned by a *different* module (including archived
 * ones — ids are permanent, because progress and reward rows reference them).
 */
async function assertIdsNotOwnedElsewhere(mod, transaction) {
  const lessonIds = mod.lessons.map((l) => l.id);
  const exerciseIds = mod.lessons.flatMap((l) => l.exercises.map((e) => e.id));
  const [lessonClashes, exerciseClashes] = await Promise.all([
    lessonIds.length
      ? CurriculumLesson.findAll({ where: { id: lessonIds, moduleId: { [Op.ne]: mod.id } }, transaction })
      : [],
    exerciseIds.length
      ? CurriculumExercise.findAll({ where: { id: exerciseIds, moduleId: { [Op.ne]: mod.id } }, transaction })
      : [],
  ]);
  const problems = [
    ...lessonClashes.map((row) => `${mod.id}: lesson id "${row.id}" already belongs to module "${row.moduleId}"`),
    ...exerciseClashes.map((row) => `${mod.id}: exercise id "${row.id}" already belongs to module "${row.moduleId}"`),
  ];
  if (problems.length) throw badRequest(`Module "${mod.id}" reuses ids owned by other modules`, problems);
}

/**
 * Brings one module's lookup rows in line with its lessons: upserts current lessons and
 * exercises (un-archiving any that came back) and archives the ones no longer present.
 */
async function syncLookups(mod, transaction) {
  const now = new Date();
  const lessonIds = mod.lessons.map((l) => l.id);
  const exerciseIds = [];

  for (const lesson of mod.lessons) {
    await CurriculumLesson.upsert({
      id: lesson.id,
      moduleId: mod.id,
      order: lesson.order,
      week: lesson.week,
      title: lesson.title,
      comingSoon: lesson.comingSoon === true,
      exerciseCount: lesson.exercises.length,
      archivedAt: null,
    }, { transaction });
  }
  for (const lesson of mod.lessons) {
    for (const exercise of lesson.exercises) {
      exerciseIds.push(exercise.id);
      await CurriculumExercise.upsert({
        id: exercise.id,
        lessonId: lesson.id,
        moduleId: mod.id,
        type: exercise.type,
        order: exercise.order,
        archivedAt: null,
      }, { transaction });
    }
  }

  const [archivedExercises] = await CurriculumExercise.update(
    { archivedAt: now },
    { where: { moduleId: mod.id, archivedAt: null, ...(exerciseIds.length ? { id: { [Op.notIn]: exerciseIds } } : {}) }, transaction }
  );
  const [archivedLessons] = await CurriculumLesson.update(
    { archivedAt: now },
    { where: { moduleId: mod.id, archivedAt: null, ...(lessonIds.length ? { id: { [Op.notIn]: lessonIds } } : {}) }, transaction }
  );
  return { archivedLessons, archivedExercises };
}

class CurriculumService {
  validateModule(mod) {
    return validateModule(mod);
  }

  /**
   * Creates or updates one module and its lookup rows inside `transaction`.
   * Returns { id, status, version, ... } where status is one of:
   *   created   — new module
   *   updated   — content changed (version bumped)
   *   restored  — was archived, content unchanged
   *   reordered — only its display position changed (no version bump)
   *   unchanged — nothing to do
   *
   * A curriculum write never touches an admin-built module with the same id, and vice
   * versa — that would silently overwrite someone's work.
   */
  async upsertModule(mod, { source, sortOrder = 0, createdByUserId = null }, transaction) {
    const errors = validateModule(mod);
    if (errors.length) throw badRequest(`Module "${mod?.id ?? '?'}" is invalid`, errors);

    await assertIdsNotOwnedElsewhere(mod, transaction);

    const content = contentOf(mod);
    const contentHash = hashContent(content);
    const counts = {
      lessonCount: mod.lessons.length,
      exerciseCount: mod.lessons.reduce((sum, l) => sum + l.exercises.length, 0),
    };

    const existing = await CurriculumModule.findByPk(mod.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (existing && existing.source !== source) {
      throw badRequest(`Module id "${mod.id}" is already used by a ${existing.source} module`, [
        `${mod.id}: existing source is "${existing.source}", this write is "${source}"`,
      ]);
    }

    if (!existing) {
      await CurriculumModule.create({
        id: mod.id,
        ...content,
        sortOrder,
        ...counts,
        source,
        createdByUserId,
        contentHash,
        version: 1,
        archivedAt: null,
      }, { transaction });
      const archived = await syncLookups(mod, transaction);
      return { id: mod.id, status: 'created', version: 1, ...counts, ...archived };
    }

    const wasArchived = existing.archivedAt !== null;
    const contentChanged = existing.contentHash !== contentHash;
    const moved = existing.sortOrder !== sortOrder;

    if (!contentChanged && !wasArchived) {
      if (moved) await existing.update({ sortOrder }, { transaction });
      return { id: mod.id, status: moved ? 'reordered' : 'unchanged', version: existing.version, ...counts, archivedLessons: 0, archivedExercises: 0 };
    }

    const version = contentChanged ? existing.version + 1 : existing.version;
    await existing.update({ ...content, sortOrder, ...counts, contentHash, version, archivedAt: null }, { transaction });
    const archived = await syncLookups(mod, transaction);
    return { id: mod.id, status: contentChanged ? 'updated' : 'restored', version, ...counts, ...archived };
  }

  /**
   * Archives every non-archived module of `source` whose id isn't in `keepIds`, together
   * with its lessons and exercises. Nothing is deleted.
   * Returns { ids, lessons, exercises } — the archived module ids and row counts.
   */
  async archiveModulesNotIn(keepIds, { source }, transaction) {
    const now = new Date();
    const stale = await CurriculumModule.findAll({
      where: { source, archivedAt: null, id: { [Op.notIn]: keepIds.length ? keepIds : [''] } },
      transaction,
    });
    const ids = stale.map((m) => m.id);
    if (!ids.length) return { ids, lessons: 0, exercises: 0 };

    await CurriculumModule.update({ archivedAt: now }, { where: { id: ids }, transaction });
    const [lessons] = await CurriculumLesson.update({ archivedAt: now }, { where: { moduleId: ids, archivedAt: null }, transaction });
    const [exercises] = await CurriculumExercise.update({ archivedAt: now }, { where: { moduleId: ids, archivedAt: null }, transaction });
    return { ids, lessons, exercises };
  }

  /** Rebuilds the frontend's exact `Module` shape from a stored row. */
  toModuleDto(row) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      themeColor: row.themeColor,
      icon: row.icon,
      createdByTrainerId: row.createdByUserId ?? '',
      lessons: row.lessons,
      createdAt: row.createdAt.toISOString(),
      category: row.category,
      ...(row.trackName !== null ? { trackName: row.trackName } : {}),
      ageGroup: row.ageGroup,
    };
  }

  transaction(fn) {
    return sequelize.transaction(fn);
  }
}

module.exports = new CurriculumService();
module.exports.stableStringify = stableStringify;
