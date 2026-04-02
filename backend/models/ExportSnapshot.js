const mongoose = require('mongoose');

const exportSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuthAccount', index: true },
    username: { type: String, index: true },

    // what they exported
    format: { type: String, enum: ['csv', 'xlsx'], required: true },
    fields: [{ type: String }],
    filters: { type: Object },

    total: { type: Number, required: true },

    // exact records (by _id from Users collection) - LIMITED for large exports
    itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // true if itemIds is a sample (not all IDs stored)
    isSampled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

exportSnapshotSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ExportSnapshot', exportSnapshotSchema);