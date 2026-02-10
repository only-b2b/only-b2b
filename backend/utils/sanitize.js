function maskEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return "••••";
  const [local, domainFull] = email.split("@");
  const [domain, ...tldParts] = domainFull.split(".");
  const tld = tldParts.length ? "." + tldParts.join(".") : "";

  const keepLocal = Math.min(2, local.length);
  const keepDomain = Math.min(1, domain.length);

  const maskedLocal =
    local.slice(0, keepLocal) + "•".repeat(Math.max(0, local.length - keepLocal));
  const maskedDomain =
    domain.slice(0, keepDomain) + "•".repeat(Math.max(0, domain.length - keepDomain));

  return `${maskedLocal}@${maskedDomain}${tld || ""}`;
}

function maskPhone(raw) {
  if (raw == null) return "—";
  const s = String(raw);
  const digits = s.replace(/\D/g, "");
  if (!digits.length) return "••••";
  const last = digits.slice(-4);
  const ccMatch = s.match(/^\+\d{1,3}/);
  const cc = ccMatch ? ccMatch[0] + " " : "";
  return `${cc}••••••${last}`;
}

/**
 * Redact sensitive fields unless explicitly exporting
 */
function redactUserRowNA(row = {}, { forExport = false } = {}) {
  // ✅ EXPORT → return REAL data
  if (forExport) return row;

  // ❌ UI / snapshot → redact
  const out = { ...row };
  if ("EmailID" in out) out.EmailID = "NA";
  if ("DirectNumber" in out) out.DirectNumber = "NA";
  if ("CompanyNumber" in out) out.CompanyNumber = "NA";
  return out;
}

module.exports = {
  maskEmail,
  maskPhone,
  redactUserRowNA,
};
