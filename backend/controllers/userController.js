// backend/controllers/userController.js
const User = require('../models/User');
const Activity = require('../models/Activity');
const ExportSnapshot = require('../models/ExportSnapshot');
const parseAndSaveFile = require('../utils/csvParser');
const ExcelJS = require('exceljs');
const {
  EXPORT_FIELD_ORDER,
} = require('./exportSnapshotController');

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
// EXPORT USERS (STREAMING - HANDLES 100k+ RECORDS)
// ============================
const exportUsers = async (req, res) => {
  let count = 0;
  let cursor = null;

  try {
    const { search = '', format = 'csv', fields } = req.query;

    console.log(`📤 Export started: format=${format}, search="${search}"`);

    // Build query
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

    // Get total count first
    const totalCount = await User.countDocuments(finalQuery);
    console.log(`📊 Total records to export: ${totalCount}`);

    if (totalCount === 0) {
      return res.status(404).json({ error: 'No records found matching your filters' });
    }

    // Determine fields
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

    // Set response headers
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `users_export_${timestamp}.${format}`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Total-Count', totalCount.toString());

    // Stream based on format
    if (String(format).toLowerCase() === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      count = await streamXLSXExport(finalQuery, orderedFields, res, req, totalCount);
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      count = await streamCSVExport(finalQuery, orderedFields, res, req, totalCount);
    }

    console.log(`✅ Export completed: ${count} records sent`);

  } catch (err) {
    console.error('❌ Export Error:', err.message);
    console.error(err.stack);

    if (!res.headersSent) {
      res.status(500).json({ error: `Export failed: ${err.message}` });
    } else {
      // Already streaming, try to end gracefully
      try {
        res.end();
      } catch (e) {
        // Ignore
      }
    }
  }
};

// ============================
// STREAM CSV EXPORT
// ============================
async function streamCSVExport(query, fields, res, req, totalCount) {
  const projection = fields.reduce((acc, f) => ({ ...acc, [f]: 1 }), {});

  const cursor = User.find(query, projection)
    .lean()
    .batchSize(500)
    .cursor();

  let count = 0;
  const exportedIds = [];
  const MAX_SNAPSHOT_IDS = 5000;

  // CSV escape helper
  const escapeCSV = (val) => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Write BOM for Excel compatibility + header row
  res.write('\ufeff' + fields.map(escapeCSV).join(',') + '\n');

  try {
    for await (const doc of cursor) {
      const row = fields.map(f => escapeCSV(doc[f] ?? '')).join(',');
      res.write(row + '\n');

      if (exportedIds.length < MAX_SNAPSHOT_IDS) {
        exportedIds.push(doc._id);
      }
      count++;

      // Progress log every 10k
      if (count % 10000 === 0) {
        console.log(`📊 CSV Progress: ${count}/${totalCount} (${Math.round(count/totalCount*100)}%)`);
      }

      // Safety limit
      if (count >= 2000000) {
        console.warn('⚠️ Export limit reached (2M records)');
        break;
      }
    }
  } catch (cursorError) {
    console.error('❌ Cursor error:', cursorError.message);
    throw cursorError;
  }

  res.end();

  // Create snapshot in background
  createSnapshotBackground({
    reqUser: req.user,
    format: 'csv',
    fields,
    filters: query,
    totalCount: count,
    exportedIds,
  });

  return count;
}

// ============================
// STREAM XLSX EXPORT
// ============================
async function streamXLSXExport(query, fields, res, req, totalCount) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: false,
    useSharedStrings: false,
  });

  const worksheet = workbook.addWorksheet('Users', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  // Define columns
  worksheet.columns = fields.map(f => ({
    header: f,
    key: f,
    width: f === '_id' ? 25 : 18,
  }));

  const projection = fields.reduce((acc, f) => ({ ...acc, [f]: 1 }), {});

  const cursor = User.find(query, projection)
    .lean()
    .batchSize(500)
    .cursor();

  let count = 0;
  const exportedIds = [];
  const MAX_SNAPSHOT_IDS = 5000;

  try {
    for await (const doc of cursor) {
      const row = fields.reduce((acc, f) => {
        let val = doc[f];
        // Convert ObjectId and Date to strings
        if (val && typeof val === 'object') {
          if (val._bsontype === 'ObjectId' || val.toString) {
            val = val.toString();
          }
        }
        acc[f] = val ?? '';
        return acc;
      }, {});

      worksheet.addRow(row).commit();

      if (exportedIds.length < MAX_SNAPSHOT_IDS) {
        exportedIds.push(doc._id);
      }
      count++;

      if (count % 10000 === 0) {
        console.log(`📊 XLSX Progress: ${count}/${totalCount} (${Math.round(count/totalCount*100)}%)`);
      }

      if (count >= 2000000) {
        console.warn('⚠️ Export limit reached (2M records)');
        break;
      }
    }
  } catch (cursorError) {
    console.error('❌ Cursor error:', cursorError.message);
    throw cursorError;
  }

  worksheet.commit();
  await workbook.commit();

  // Create snapshot in background
  createSnapshotBackground({
    reqUser: req.user,
    format: 'xlsx',
    fields,
    filters: query,
    totalCount: count,
    exportedIds,
  });

  return count;
}

// ============================
// BACKGROUND SNAPSHOT CREATION
// ============================
function createSnapshotBackground({ reqUser, format, fields, filters, totalCount, exportedIds }) {
  setImmediate(async () => {
    try {
      await ExportSnapshot.create({
        userId: reqUser?.id || null,
        username: reqUser?.username || 'unknown',
        format,
        fields: Array.isArray(fields) ? fields : [],
        filters: filters || {},
        total: totalCount,
        itemIds: exportedIds,
        isSampled: totalCount > exportedIds.length,
      });

      await Activity.create({
        userId: reqUser?.id || null,
        username: reqUser?.username || 'unknown',
        action: 'EXPORT_USERS',
        method: 'GET',
        route: '/api/users/export',
        status: 200,
        meta: { format, total: totalCount },
      });

      console.log(`✅ Snapshot saved: ${totalCount} records (${exportedIds.length} IDs stored)`);
    } catch (e) {
      console.error('⚠️ Snapshot/Activity error:', e.message);
    }
  });
}

module.exports = {
  getUsers,
  uploadCSV,
  exportUsers,
};