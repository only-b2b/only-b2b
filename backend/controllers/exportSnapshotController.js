const ExportSnapshot = require('../models/ExportSnapshot');
const User = require('../models/User');
const { redactUserRowNA } = require('../utils/sanitize');

const EXPORT_FIELD_ORDER = [
  "FirstName",
  "LastName",
  "EmailID",
  "JobTitle",
  "Level",
  "JobFunction",
  "Dept",
  "CompanyNumber",
  "DirectNumber",
  "CompanyName",
  "Address1",
  "Address2",
  "City",
  "State",
  "PostalCode",
  "Country",
  "ActiveEmployeeSize",
  "EmployeeSize",
  "Industry",
  "MainIndustry",
  "WebsiteLink",
  "RevenueSize",
  "EmployeeLink",
  "CompanyLink",
];

// Create a snapshot record after an export
async function createExportSnapshot({ reqUser, format, fields, filters, users }) {
  const snap = await ExportSnapshot.create({
    userId: reqUser?.id || null,
    username: reqUser?.username || 'unknown',
    format,
    fields: Array.isArray(fields)
      ? fields
      : (fields ? String(fields).split(',') : []),
    filters: filters || {},
    total: users.length,
    itemIds: users.map((u) => u._id),
  });
  return snap;
}

// GET /api/exports
async function listSnapshots(req, res) {
  const { username, page = 1, limit = 20 } = req.query;
  const q = {};
  if (username) q.username = username;

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    ExportSnapshot.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    ExportSnapshot.countDocuments(q),
  ]);

  res.json({
    items,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
}

// GET /api/exports/:id
async function getSnapshot(req, res) {
  const snap = await ExportSnapshot.findById(req.params.id);
  if (!snap) return res.status(404).json({ message: 'Not found' });
  res.json(snap);
}

// GET /api/exports/:id/items
async function getSnapshotItems(req, res) {
  const { id } = req.params;
  const { page = 1, limit = 100 } = req.query;

  const snap = await ExportSnapshot.findById(id);
  if (!snap) return res.status(404).json({ message: 'Not found' });

  const start = (Number(page) - 1) * Number(limit);
  const end = start + Number(limit);
  const pageIds = snap.itemIds.slice(start, end);

  // 🔹 Rebuild projection using snapshot fields or fixed order
  const fieldsToUse =
    snap.fields && snap.fields.length ? snap.fields : EXPORT_FIELD_ORDER;

  const projection = fieldsToUse.reduce((acc, f) => {
    acc[f] = 1;
    return acc;
  }, {});

  const users = await User.find(
    { _id: { $in: pageIds } },
    projection
  ).lean();

  // keep original order
  const order = new Map(pageIds.map((v, i) => [String(v), i]));
  users.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));

  // ❌ Snapshot view → still redacted
  const sanitized = users.map(u => redactUserRowNA(u, { forExport: true }));

  res.json({
    snapshotId: snap._id,
    fields: fieldsToUse,
    total: snap.total,
    page: Number(page),
    items: sanitized,
  });
}

module.exports = {
  createExportSnapshot,
  listSnapshots,
  getSnapshot,
  getSnapshotItems,
  EXPORT_FIELD_ORDER, // optional but useful
};
