// backend/controllers/userController.js
const User = require('../models/User');
const Activity = require('../models/Activity');
const parseAndSaveFile = require('../utils/csvParser');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
const { createExportSnapshot } = require('./exportSnapshotController'); // make sure this path/file exists
const { redactUserRowNA } = require('../utils/sanitize');

// ✅ GET USERS with full support for search, filters, pagination, sorting
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

    // General search
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

    // Multi-field filters (supports arrays or comma-separated strings)
    Object.entries(filters).forEach(([field, value]) => {
      if (!value) return;

      const values = Array.isArray(value)
        ? value
        : typeof value === 'string' && value.includes(',')
        ? value.split(',')
        : [value];

      if (values.length === 1) {
        andConditions.push({ [field]: { $regex: values[0], $options: 'i' } });
      } else {
        andConditions.push({
          $or: values.map((v) => ({ [field]: { $regex: v, $options: 'i' } })),
        });
      }
    });

    const searchQuery = andConditions.length > 0 ? { $and: andConditions } : {};
    const sortOptions = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const users = await User.find(searchQuery)
      .sort(sortOptions)
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(searchQuery);

    res.json({ users, total });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ UPLOAD CSV (logs who uploaded via req.user)
const uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await parseAndSaveFile(req.file.path, req.file.originalname, req.user);
    const processed = typeof result === 'number' ? result : result.processed;
    res.json({
      message: `${req.file.originalname} uploaded successfully.`,
      processed,
      reportId: result.reportId,
      stats: result,
    });
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ EXPORT USERS (CSV / XLSX) with filters + field selection + SNAPSHOT + ACTIVITY
const exportUsers = async (req, res) => {
  try {
    const { search = '', format = 'csv', fields } = req.query;

    // Build the query like in getUsers
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
      if (excludedKeys.includes(field)) return;
      if (!value) return;

      const values = Array.isArray(value)
        ? value
        : typeof value === 'string' && value.includes(',')
        ? value.split(',')
        : [value];

      if (values.length === 1) {
        clauses.push({ [field]: { $regex: values[0], $options: 'i' } });
      } else {
        clauses.push({
          $or: values.map((v) => ({ [field]: { $regex: v, $options: 'i' } })),
        });
      }
    });

    const finalQuery = clauses.length > 0 ? { $and: clauses } : {};

    // Field projection
    let projection = null;
    let fieldArray = [];
    if (fields) {
      fieldArray = fields.split(',').map((f) => f.trim()).filter(Boolean);
      if (fieldArray.length) projection = fieldArray.join(' ');
    }

    // Fetch exact rows to export
    const users = await User.find(finalQuery).select(projection).lean();

    // Redact sensitive fields with "NA"
      const redactedUsers = users.map(redactUserRowNA);
      
    // Build a normalized filters object for the snapshot
    const filtersObj = {};
    Object.entries(req.query).forEach(([k, v]) => {
      if (excludedKeys.includes(k) || v == null || v === '') return;
      const values = Array.isArray(v)
        ? v
        : String(v).includes(',')
        ? String(v).split(',')
        : [String(v)];
      filtersObj[k] = values;
    });

    // Create snapshot + activity (don’t block response if they fail)
    try {
      const fmt = String(format).toLowerCase();
      const snap = await createExportSnapshot({
        reqUser: req.user,          // from verifyJWT
        format: fmt,
        fields: fieldArray,
        filters: { search, ...filtersObj },
        users: redactedUsers, // exact rows (masked)    
      });

      await Activity.create({
        userId: req.user?.id || null,
        username: req.user?.username || 'unknown',
        action: 'EXPORT_USERS',
        method: req.method,
        route: req.originalUrl,
        status: 200,
        meta: { snapshotId: snap._id, total: snap.total, format: fmt, fields: fieldArray, filters: { search, ...filtersObj } },
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
    } catch (e) {
      console.error('snapshot/activity error:', e.message);
    }

    // Send file
    if (String(format).toLowerCase() === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(redactedUsers);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    const parser = new Parser({ fields: fieldArray.length > 0 ? fieldArray : undefined });
    const csv = parser.parse(redactedUsers);
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
