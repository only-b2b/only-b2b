// backend/controllers/userController.js
const User = require('../models/User');
const Activity = require('../models/Activity');
const parseAndSaveFile = require('../utils/csvParser');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
const {
  createExportSnapshot,
  EXPORT_FIELD_ORDER,
} = require('./exportSnapshotController');
const { redactUserRowNA } = require('../utils/sanitize');

// ============================
// GET USERS
// ============================
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      sortField = 'createdAt',
      sortOrder = 'desc',
      ...filters
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const andConditions = [];

    if (search) {
      andConditions.push({
        $or: [
          { FirstName: { $regex: search, $options: 'i' } },
          { LastName: { $regex: search, $options: 'i' } },
          { EmailID: { $regex: search, $options: 'i' } },
          { CompanyName: { $regex: search, $options: 'i' } },
          { JobTitle: { $regex: search, $options: 'i' } },
          { JobFunction: { $regex: search, $options: 'i' } },
        ],
      });
    }

    Object.entries(filters).forEach(([field, value]) => {
      if (!value) return;
      const values = Array.isArray(value)
        ? value
        : String(value).includes(',')
        ? String(value).split(',')
        : [value];

      if (values.length === 1) {
        andConditions.push({ [field]: { $regex: values[0], $options: 'i' } });
      } else {
        andConditions.push({
          $or: values.map(v => ({ [field]: { $regex: v, $options: 'i' } })),
        });
      }
    });

    const query = andConditions.length ? { $and: andConditions } : {};
    const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const users = await User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(query);
    res.json({ users, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============================
// UPLOAD CSV
// ============================
const uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await parseAndSaveFile(
      req.file.path,
      req.file.originalname,
      req.user
    );

    res.json({
      message: `${req.file.originalname} uploaded successfully.`,
      ...result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ============================
// EXPORT USERS (CSV / XLSX)
// ============================
const exportUsers = async (req, res) => {
  try {
    const { search = '', format = 'csv', fields } = req.query;

    const clauses = [];
    if (search) {
      clauses.push({
        $or: [
          { FirstName: { $regex: search, $options: 'i' } },
          { LastName: { $regex: search, $options: 'i' } },
          { EmailID: { $regex: search, $options: 'i' } },
          { CompanyName: { $regex: search, $options: 'i' } },
          { JobTitle: { $regex: search, $options: 'i' } },
          { JobFunction: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const excludedKeys = ['search', 'format', 'fields'];
    Object.entries(req.query).forEach(([field, value]) => {
      if (excludedKeys.includes(field) || !value) return;

      const values = Array.isArray(value)
        ? value
        : String(value).includes(',')
        ? String(value).split(',')
        : [value];

      if (values.length === 1) {
        clauses.push({ [field]: { $regex: values[0], $options: 'i' } });
      } else {
        clauses.push({
          $or: values.map(v => ({ [field]: { $regex: v, $options: 'i' } })),
        });
      }
    });

    const finalQuery = clauses.length ? { $and: clauses } : {};

    // ============================
    // FINAL COLUMN ORDER
    // _id FIRST, createdAt/updatedAt LAST
    // ============================
    const selectedFields = fields
      ? fields.split(',').map(f => f.trim()).filter(Boolean)
      : EXPORT_FIELD_ORDER;

    const orderedFields = [
      '_id',
      ...selectedFields.filter(
        f => !['_id', 'createdAt', 'updatedAt'].includes(f)
      ),
      'createdAt',
      'updatedAt',
    ];

    const projection = orderedFields.join(' ');

    const users = await User.find(finalQuery).select(projection).lean();

    // REAL DATA FOR EXPORT
    const exportUsersData = users.map(user => {
      const clean = redactUserRowNA(user, { forExport: true });
      const row = {};
      orderedFields.forEach(f => {
        row[f] = clean[f] ?? '';
      });
      return row;
    });

    // SNAPSHOT + ACTIVITY
    try {
      const snap = await createExportSnapshot({
        reqUser: req.user,
        format: String(format).toLowerCase(),
        fields: orderedFields,
        filters: { search },
        users,
      });

      await Activity.create({
        userId: req.user?.id || null,
        username: req.user?.username || 'unknown',
        action: 'EXPORT_USERS',
        method: req.method,
        route: req.originalUrl,
        status: 200,
        meta: { snapshotId: snap._id, total: users.length },
      });
    } catch (e) {
      console.error('snapshot/activity error:', e.message);
    }

    // ============================
    // XLSX
    // ============================
    if (String(format).toLowerCase() === 'xlsx') {
      const worksheetData = [
        orderedFields,
        ...exportUsersData.map(u => orderedFields.map(f => u[f])),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

      const buffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'buffer',
      });

      res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
      res.type(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      return res.send(buffer);
    }

    // ============================
    // CSV
    // ============================
    const parser = new Parser({ fields: orderedFields });
    const csv = parser.parse(exportUsersData);

    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.type('text/csv');
    return res.send(csv);
  } catch (err) {
    console.error('Export Error:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUsers,
  uploadCSV,
  exportUsers,
};
