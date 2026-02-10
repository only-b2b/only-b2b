const fs = require("fs");
const XLSX = require("xlsx");
const fastcsv = require("fast-csv");
const User = require("../models/User");
const Activity = require("../models/Activity");
const UploadReport = require("../models/UploadReport");

function normalizeRow(row) {
    return {
        FirstName: row.FirstName || row["First Name"] || "",
        LastName: row.LastName || row["Last Name"] || "",
        JobTitle: row.JobTitle || row["Job Title"] || "",
        JobFunction: row.JobFunction || row["Job Function"] || "",
        Level: row.Level || "",

        Dept: row.Dept || row.Department || row["Department"] || "", // ✅ map Department

        EmailID: row.EmailID || row["Email ID"] || "",
        CompanyNumber: row.CompanyNumber || row["Company Number"] || "",
        DirectNumber: row.DirectNumber || row["Direct Number"] || "",
        CompanyName: row.CompanyName || row["Company Name"] || "",
        Address1: row.Address1 || row["Address 1"] || "",
        Address2: row.Address2 || row["Address 2"] || "",
        City: row.City || "",
        State: row.State || "",
        PostalCode: row.PostalCode || row["Postal Code"] || "",
        Country: row.Country || "",

        ActiveEmployeeSize: row.ActiveEmployeeSize || row["Active Employee Size"] || "",
        EmployeeSize: row.EmployeeSize || row["Employee Size"] || "", // ✅ map Employee Size

        Industry: row.Industry || "",
        MainIndustry: row.MainIndustry || row["Main Industry"] || "", // ✅ map Main Industry
        SubIndustry: row.SubIndustry || row["Sub Industry"] || "",
        WebsiteLink: row.WebsiteLink || row["Website Link"] || "",
        RevenueSize: row.RevenueSize || row["Revenue Size"] || "",
        EmployeeLink: row.EmployeeLink || row["Employee Link"] || "",
        CompanyLink: row.CompanyLink || row["Company Link"] || ""
    };
}



// Backward-compatible: new third arg is optional (currentUser)
async function parseAndSaveFile(filePath, originalName, currentUser = null) {
    let users = [];

    if (originalName.endsWith(".xlsx")) {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        users = sheetData.map(normalizeRow);
    } 
    else if (originalName.endsWith(".csv")) {
        users = await new Promise((resolve, reject) => {
            const rows = [];
            fs.createReadStream(filePath)
                .pipe(fastcsv.parse({ headers: true }))
                .on("data", (row) => rows.push(normalizeRow(row)))
                .on("end", () => resolve(rows))
                .on("error", reject);
        });
    } 
    else {
        throw new Error("Unsupported file format. Please upload CSV or XLSX.");
    }

    // === compute duplicates inside the uploaded file (by EmailID) ===
    const counts = new Map();
    for (const u of users) {
      const key = (u.EmailID || "").trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const duplicatesInFile = Array.from(counts.entries())
      .filter(([, c]) => c > 1)
      .map(([EmailID, count]) => ({ EmailID, count }));

    // === which emails already exist in DB BEFORE upsert ===
    const allEmails = Array.from(counts.keys()).filter(Boolean);
    let existingEmails = [];
    if (allEmails.length) {
      const existing = await User.find({ EmailID: { $in: allEmails } }).select("EmailID").lean();
      existingEmails = existing.map((d) => d.EmailID);
    }

    // Bulk Upsert
    let inserted = 0;
    if (users.length > 0) {
        const result = await User.bulkWrite(
            users.map((user) => ({
                updateOne: {
                    filter: { EmailID: user.EmailID },
                    update: { $set: user },
                    upsert: true
                }
            }))
        );

        inserted = result?.upsertedCount || 0;

        // record a domain activity (non-blocking). If currentUser not provided, falls back to 'unknown'
        try {
          await Activity.create({
            userId: currentUser?.id || null,
            username: currentUser?.username || 'unknown',
            action: 'UPLOAD_CSV',
            method: 'POST',
            route: '/api/users/upload',
            status: 200,
            meta: { filename: originalName, processed: users.length, inserted, updated: users.length - inserted }
          });
        } catch (e) {
          console.error('activity log error:', e.message);
        }
    }

    fs.unlinkSync(filePath);
    // Create & return a report document you can open in UI
    const report = await UploadReport.create({
      userId: currentUser?.id || null,
      username: currentUser?.username || 'unknown',
      filename: originalName,
      processed: users.length,
      inserted,
      updated: users.length - inserted,
      duplicatesInFile,            // [{ EmailID, count }]
      duplicatesExisting: existingEmails, // [EmailID]
    });

    return {
      processed: users.length,
      inserted,
      updated: users.length - inserted,
      reportId: report._id,
      duplicatesInFileCount: duplicatesInFile.length,
      duplicatesExistingCount: existingEmails.length,
    };
}

module.exports = parseAndSaveFile;
