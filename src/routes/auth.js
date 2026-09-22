const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { isValidEmail, validatePassword } = require('../utils/validation');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const SELF_SERVICE_ROLES = ['student', 'instructor'];

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
    res.status(201).json({
      accessToken,
      user: toUserResponse(user),
    });
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
