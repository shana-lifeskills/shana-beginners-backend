const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { User, StudentProfile, sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');
const { isValidEmail, isValidGhanaPhone, validatePassword } = require('../utils/validation');
const { sendVerificationEmail } = require('../services/emailService');

const GENDERS = ['male', 'female'];
const ENROL_PROGRAMS = ['soft-skills', 'tech-skills', 'language-skills', 'personal-coaching'];
const HEAR_ABOUT_OPTIONS = ['whatsapp', 'instagram', 'facebook', 'family-friend', 'other'];

/**
 * Validates the child-registration details collected during student
 * signup (see StudentSignupStepper on the frontend). Returns
 * `{ valid: false, message }` on the first problem found, or
 * `{ valid: true, data }` with the trimmed/normalized fields ready to
 * persist.
 */
function validateStudentProfile(body) {
  const required = (value, label) => {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      return `${label} is required`;
    }
    return null;
  };

  const missing =
    required(body.gender, 'Gender') ||
    required(body.dateOfBirth, 'Date of birth') ||
    required(body.age, 'Age') ||
    required(body.school, 'School') ||
    required(body.gradeClass, 'Grade/Class') ||
    required(body.country, 'Country') ||
    required(body.parentGuardianName, "Parent/guardian's name") ||
    required(body.parentPhone, 'Phone number') ||
    required(body.parentWhatsapp, 'WhatsApp number') ||
    required(body.enrolProgram, 'Program') ||
    required(body.growthAreas, 'Growth areas') ||
    required(body.desiredSkills, 'Desired skills');
  if (missing) return { valid: false, message: missing };

  if (!GENDERS.includes(body.gender)) {
    return { valid: false, message: 'Gender must be male or female' };
  }

  const dob = new Date(body.dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    return { valid: false, message: 'Date of birth must be a valid, non-future date' };
  }

  const age = Number(body.age);
  if (!Number.isInteger(age) || age < 3 || age > 17) {
    return { valid: false, message: 'Age must be a whole number between 3 and 17' };
  }

  if (!isValidGhanaPhone(body.parentPhone)) {
    return { valid: false, message: 'Enter a valid phone number (10 digits starting with 0, or with 233)' };
  }
  if (!isValidGhanaPhone(body.parentWhatsapp)) {
    return { valid: false, message: 'Enter a valid WhatsApp number (10 digits starting with 0, or with 233)' };
  }

  if (!ENROL_PROGRAMS.includes(body.enrolProgram)) {
    return { valid: false, message: 'Invalid program selection' };
  }

  if (!Array.isArray(body.howDidYouHear) || body.howDidYouHear.length === 0) {
    return { valid: false, message: 'Select at least one option for how you heard about us' };
  }
  if (body.howDidYouHear.some((v) => !HEAR_ABOUT_OPTIONS.includes(v))) {
    return { valid: false, message: 'Invalid selection for how you heard about us' };
  }
  if (body.howDidYouHear.includes('other') && !(body.howDidYouHearOther && body.howDidYouHearOther.trim())) {
    return { valid: false, message: 'Please tell us how you heard about us' };
  }

  if (body.termsAccepted !== true) {
    return { valid: false, message: 'You must accept the Terms and Conditions to continue' };
  }

  return {
    valid: true,
    data: {
      middleName: body.middleName && typeof body.middleName === 'string' ? body.middleName.trim() || null : null,
      preferredName: body.preferredName && typeof body.preferredName === 'string' ? body.preferredName.trim() || null : null,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth,
      age,
      school: body.school.trim(),
      gradeClass: body.gradeClass.trim(),
      country: body.country.trim(),
      parentGuardianName: body.parentGuardianName.trim(),
      parentPhone: body.parentPhone.trim(),
      parentWhatsapp: body.parentWhatsapp.trim(),
      enrolProgram: body.enrolProgram,
      howDidYouHear: body.howDidYouHear,
      howDidYouHearOther: body.howDidYouHearOther && typeof body.howDidYouHearOther === 'string' ? body.howDidYouHearOther.trim() || null : null,
      growthAreas: body.growthAreas.trim(),
      desiredSkills: body.desiredSkills.trim(),
      termsAcceptedAt: new Date(),
    },
  };
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const EMAIL_VERIFICATION_EXPIRY = '24h';
// 'instructor' is the real Trainer role (displayed as "Trainer" in the UI) —
// reviews assignment submissions and tracks student progress. 'admin' is the
// separate, earlier-built role that uploads/assigns modules.
const SELF_SERVICE_ROLES = ['student', 'admin', 'instructor'];

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

function generateEmailVerificationToken(user) {
  return jwt.sign(
    { id: user.id, purpose: 'verify-email' },
    process.env.JWT_SECRET,
    { expiresIn: EMAIL_VERIFICATION_EXPIRY }
  );
}

async function issueAndSendVerificationEmail(user) {
  const token = generateEmailVerificationToken(user);
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:4200'}/verify-email?token=${token}`;
  try {
    await sendVerificationEmail(user, verifyUrl);
  } catch (err) {
    // A flaky mail server shouldn't fail registration/login — the user can
    // always hit "resend" once they notice the email never arrived.
    console.error('Could not send verification email:', err.message);
  }
}

function setRefreshTokenCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

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
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, profileImage, role, studentProfile } = req.body;

    if (role !== undefined && !SELF_SERVICE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return res.status(400).json({ message: 'First name is required' });
    }
    if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
      return res.status(400).json({ message: 'Last name is required' });
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Password is required' });
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    // Only the student signup stepper sends this — validated in full before
    // touching the database, so a bad profile never leaves a half-created User.
    const resolvedRole = role ?? 'student';
    let studentProfileData = null;
    if (resolvedRole === 'student' && studentProfile) {
      const result = validateStudentProfile(studentProfile);
      if (!result.valid) {
        return res.status(400).json({ message: result.message });
      }
      studentProfileData = result.data;
    }

    const existing = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // TEMPORARY DEMO BYPASS: Resend has no verified sending domain yet, so
    // it can only deliver to one specific address (see emailService.js) —
    // every other real signup would get stuck unable to receive its
    // verification link at all. When set, new accounts skip straight to
    // verified instead. Turn AUTO_VERIFY_EMAIL off once a domain is
    // verified in Resend and real delivery works for any address.
    const autoVerify = process.env.AUTO_VERIFY_EMAIL === 'true';

    const user = await sequelize.transaction(async (t) => {
      const created = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        profileImage: profileImage && typeof profileImage === 'string' ? profileImage.trim() || null : null,
        role: resolvedRole,
        emailVerified: autoVerify,
      }, { transaction: t });

      if (studentProfileData) {
        await StudentProfile.create({ ...studentProfileData, userId: created.id }, { transaction: t });
      }

      return created;
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshTokenCookie(res, refreshToken);
    if (!autoVerify) {
      await issueAndSendVerificationEmail(user);
    }
    res.status(201).json({
      accessToken,
      user: toUserResponse(user),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'A verification token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'This verification link is invalid or has expired' });
    }
    if (decoded.purpose !== 'verify-email') {
      return res.status(400).json({ message: 'This verification link is invalid' });
    }

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'Account not found' });
    }
    if (!user.emailVerified) {
      await user.update({ emailVerified: true });
    }
    res.json({ message: 'Email verified', emailVerified: true });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-verification', authenticate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Account not found' });
    }
    if (user.emailVerified) {
      return res.json({ message: 'Email already verified' });
    }
    await issueAndSendVerificationEmail(user);
    res.json({ message: 'Verification email sent' });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const emailNorm = email && typeof email === 'string' ? email.trim().toLowerCase() : '';
    const user = await User.findOne({ where: { email: emailNorm } });
    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.emailVerified) {
      // Correct credentials, but the account is locked out of signing in
      // again until it's verified — send a fresh link on every blocked
      // attempt so a stale/lost first email doesn't strand the user.
      await issueAndSendVerificationEmail(user);
      return res.status(403).json({
        message: 'Please verify your email before signing in — we just sent a new link to your inbox.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshTokenCookie(res, refreshToken);
    res.json({
      accessToken,
      user: toUserResponse(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'No refresh token' });
    }
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    setRefreshTokenCookie(res, newRefreshToken);
    res.json({ accessToken });
  } catch (err) {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
