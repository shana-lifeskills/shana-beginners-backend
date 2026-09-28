/**
 * Loads the curriculum export (db/curriculum/curriculum.json, produced by the frontend's
 * `npm run export:curriculum`) into CurriculumModules and its lookup tables.
 *
 * Safe to run repeatedly: unchanged modules are skipped, changed ones get a new version,
 * and modules missing from the file are archived (never deleted). Admin-built modules
 * are never touched. Everything happens in one transaction — any problem leaves the
 * database exactly as it was.
 *
 * Usage:
 *   node scripts/seed-curriculum.js [--file <path>] [--dry-run]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/models');
const curriculumService = require('../src/services/curriculumService');

const DEFAULT_FILE = path.resolve(__dirname, '..', 'db', 'curriculum', 'curriculum.json');

function parseArgs(argv) {
  const args = { file: DEFAULT_FILE, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--file') args.file = path.resolve(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

/** Everything wrong with the file as a whole, before any database work. */
function validateFile(modules) {
  const errors = [];
  const owners = { module: new Map(), lesson: new Map(), exercise: new Map() };
  const claim = (kind, id, owner) => {
    if (typeof id !== 'string') return;
    const previous = owners[kind].get(id);
    if (previous) errors.push(`duplicate ${kind} id "${id}" — used in ${previous} and ${owner}`);
    else owners[kind].set(id, owner);
  };

  modules.forEach((mod, mi) => {
    errors.push(...curriculumService.validateModule(mod));
    const where = mod?.id ?? `modules[${mi}]`;
    claim('module', mod?.id, `modules[${mi}]`);
    (Array.isArray(mod?.lessons) ? mod.lessons : []).forEach((lesson) => {
      claim('lesson', lesson?.id, `${where} > ${lesson?.id}`);
      (Array.isArray(lesson?.exercises) ? lesson.exercises : []).forEach((exercise) => {
        claim('exercise', exercise?.id, `${where} > ${lesson?.id} (${exercise?.type})`);
      });
    });
  });
  return [...new Set(errors)];
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  const modules = payload.modules;
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new Error(`${args.file} has no "modules" array`);
  }

  const fileErrors = validateFile(modules);
  if (fileErrors.length) {
    console.error(`✘ ${args.file} has ${fileErrors.length} problem(s); nothing was written:`);
    fileErrors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    const results = [];
    for (const [index, mod] of modules.entries()) {
      results.push(await curriculumService.upsertModule(mod, { source: 'curriculum', sortOrder: index }, transaction));
    }
    const archivedModules = await curriculumService.archiveModulesNotIn(modules.map((m) => m.id), { source: 'curriculum' }, transaction);
    const archivedLessons = results.reduce((n, r) => n + r.archivedLessons, 0) + archivedModules.lessons;
    const archivedExercises = results.reduce((n, r) => n + r.archivedExercises, 0) + archivedModules.exercises;

    if (args.dryRun) await transaction.rollback();
    else await transaction.commit();

    const tally = (status) => results.filter((r) => r.status === status).length;
    const sum = (key) => results.reduce((total, r) => total + r[key], 0);
    console.log(`${args.dryRun ? '[dry run — rolled back] ' : ''}Curriculum from ${path.relative(process.cwd(), args.file)}`);
    console.log(`  exported:  ${payload.exportedAt ?? 'unknown'}`);
    console.log(`  modules:   ${modules.length}  (created ${tally('created')}, updated ${tally('updated')}, restored ${tally('restored')}, reordered ${tally('reordered')}, unchanged ${tally('unchanged')})`);
    console.log(`  lessons:   ${sum('lessonCount')}`);
    console.log(`  exercises: ${sum('exerciseCount')}`);
    console.log(`  archived:  ${archivedModules.ids.length} module(s)${archivedModules.ids.length ? ` [${archivedModules.ids.join(', ')}]` : ''}, ${archivedLessons} lesson(s), ${archivedExercises} exercise(s)`);
    results.filter((r) => !['unchanged', 'reordered'].includes(r.status)).forEach((r) => console.log(`    ${r.status.padEnd(9)} ${r.id} → v${r.version}`));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error(`✘ ${error.message}; nothing was written.`);
    (error.details ?? []).forEach((d) => console.error(`  - ${d}`));
    process.exitCode = 1;
  }
}

run()
  .catch((error) => {
    console.error(`✘ ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
