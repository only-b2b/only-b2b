const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AuthAccount = require('../models/AuthAccount');

const sign = (account) =>
  jwt.sign(
    { id: account._id, username: account.username, role: account.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// POST /api/auth/login
const login = async (req, res) => {
  try {
    let { username, password } = req.body;
    username = (username || '').trim().toLowerCase();   // ✅ normalize username

    const account = await AuthAccount.findOne({ username, isActive: true });
    if (!account) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await account.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    account.lastLoginAt = new Date();
    await account.save();

    const token = sign(account);
    return res.json({
      token,
      user: {
        id: account._id,
        username: account.username,
        name: account.name,
        role: account.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Login failed' });
  }
};

// POST /api/auth/bootstrap  (safe re-run)
const bootstrapUsers = async (_req, res) => {
  try {
    const seed = [
        { "username": "ameet.bhinganiya",     "name": "Ameet Bhinganiya",    "role": "admin",   "password": "Ameet@1433" },
        { "username": "prem.borkar",          "name": "Prem Borkar",         "role": "admin",   "password": "Ghostrider" },
        { "username": "Hemant.Bhatt",         "name": "Hemant Bhatt",        "role": "admin",   "password": "Hemant@8655" },
        { "username": "Vikas.Bhatt",          "name": "Vikas Bhatt",         "role": "admin",   "password": "Vikas@8655" },
        { "username": "suraj.nargargoje",     "name": "Suraj Nargargoje",    "role": "admin",   "password": "Suraj@9876" },
        { "username": "auditor",              "name": "Audit Viewer",        "role": "auditor", "password": "DareDevil@987" },
        { "username": "shashank",             "name": "Shashank Bhardwaj",   "role": "user",    "password": "Shashank123" },
        { "username": "user2",                "name": "Guest User2",         "role": "user",    "password": "Passw0rd!1" },
        { "username": "user3",                "name": "Guest User3",         "role": "user",    "password": "Passw0rd!1" },
        { "username": "viyom.daga",           "name": "Viyom Daga",          "role": "user",    "password": "Passw0rd!1" },
        { "username": "sumeet.agrawal",       "name": "Sumeet Agrawal",      "role": "user",    "password": "Sumeet@571" },
        { "username": "user4",                "name": "Guest User4",         "role": "user",    "password": "Neelam#2024" },
        { "username": "user5",                "name": "Guest User5",         "role": "admin",   "password": "ItAdmin!234" },
        { "username": "user6",                "name": "Guest User6",         "role": "auditor", "password": "Guest@123" },
        { "username": "user7",                "name": "Guest user7",         "role": "user",    "password": "Kavita@2025" }
      ];

    for (const s of seed) {
      const username = s.username.trim().toLowerCase();  // ✅ normalize
      const passwordHash = await bcrypt.hash(s.password, 10);
      await AuthAccount.updateOne(
        { username },
        { $set: { username, name: s.name, role: s.role, passwordHash, isActive: true } },
        { upsert: true }
      );
    }
    res.json({ message: 'Seed sync complete' });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ message: 'Bootstrap failed' });
  }
};

module.exports = { login, bootstrapUsers };
