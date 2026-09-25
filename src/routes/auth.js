const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { isValidEmail, validatePassword } = require('../utils/validation');
const { sendVerificationEmail } = require('../services/emailService');

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
    const { firstName, lastName, email, password, profileImage, role } = req.body;

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

    const existing = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      profileImage: profileImage && typeof profileImage === 'string' ? profileImage.trim() || null : null,
      role: role ?? 'student',
    });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshTokenCookie(res, refreshToken);
    await issueAndSendVerificationEmail(user);
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
