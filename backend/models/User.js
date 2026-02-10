const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    FirstName: String,
    LastName: String,
    JobTitle: String,
    JobFunction: String,
    Level: String,
    Dept: String,           // ✅ added
    EmailID: { type: String, unique: true, sparse: true },
    CompanyNumber: String,
    DirectNumber: String,
    CompanyName: String,
    Address1: String,
    Address2: String,
    City: String,
    State: String,
    PostalCode: String,
    Country: String,
    ActiveEmployeeSize: String,
    EmployeeSize: String,   // ✅ added
    Industry: String,
    MainIndustry: String,   // ✅ added
    WebsiteLink: String,
    RevenueSize: String,
    EmployeeLink: String,
    CompanyLink: String
}, { timestamps: true });



userSchema.index({ EmailID: 1 });

module.exports = mongoose.model("User", userSchema);
