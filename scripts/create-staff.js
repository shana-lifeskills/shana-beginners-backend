/**
 * Creates an Admin or Trainer account. Public signup is students-only, so this is how
 * staff get access.
 *
 * Usage:
 *   npm run staff:create -- --email jo@school.org --first Jo --last Mensah --role admin
 *   npm run staff:create -- --email kofi@school.org --first Kofi --last Boateng --role trainer
 *
 * --role: `admin` (uploads/assigns modules; backend role "admin") or `trainer`
 * (reviews submissions, tracks progress; backend role "instructor").
 * The password comes from STAFF_PASSWORD if set; otherwise a strong one is generated
 * and printed once — hand it over securely and ask them to change it.
 */
require('dotenv').config();
const crypto = require('crypto');
const { sequelize, User } = require('../src/models');
const { isValidEmail, validatePassword } = require('../src/utils/validation');

const ROLES = { admin: 'admin', trainer: 'instructor' };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (!['email', 'first', 'last', 'role'].includes(key)) throw new Error(`Unknown argument: ${argv[i]}`);
    args[key] = argv[i + 1];
  }
  return args;
}

function generatePassword() {
  // 16 chars from an unambiguous alphabet, guaranteed to contain a letter and a digit.
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(letters), pick(digits), ...Array.from({ length: 14 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function run() {
  const { email, first, last, role } = parseArgs(process.argv.slice(2));
  const problems = [];
  if (!email || !isValidEmail(email)) problems.push('--email must be a valid email address');
  if (!first?.trim()) problems.push('--first is required');
  if (!last?.trim()) problems.push('--last is required');
  if (!ROLES[role]) problems.push('--role must be "admin" or "trainer"');

  const generated = !process.env.STAFF_PASSWORD;
  const password = process.env.STAFF_PASSWORD ?? generatePassword();
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) problems.push(`STAFF_PASSWORD: ${passwordCheck.message}`);

  if (problems.length) {
    problems.forEach((p) => console.error(`✘ ${p}`));
    process.exitCode = 1;
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.findOne({ where: { email: normalizedEmail } })) {
    console.error(`✘ An account for ${normalizedEmail} already exists; nothing was changed.`);
    process.exitCode = 1;
    return;
  }

  const user = await User.create({
    firstName: first.trim(),
    lastName: last.trim(),
    email: normalizedEmail,
    password,
    role: ROLES[role],
    emailVerified: true,
    hasSeenWelcome: true,
  });

  console.log(`✔ Created ${role} account ${user.email} (id ${user.id})`);
  if (generated) console.log(`  Temporary password (shown once): ${password}`);
}

run()
  .catch((error) => {
    console.error(`✘ ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
