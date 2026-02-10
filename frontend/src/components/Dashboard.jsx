// ========================= src/components/Dashboard.jsx (UPDATED) =========================
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES } from "../constants/countries";
import api from "../api/apiClient";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Columns3,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import "../style/Dashboard.css";


export default function Dashboard() {
  // Pagination / sorting / search
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState("FirstName");
  const [sortOrder, setSortOrder] = useState("asc");

  // UI state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Outside click & ESC to close menus
  const exportRef = useRef(null);
  const columnsRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
      if (columnsRef.current && !columnsRef.current.contains(e.target)) setColumnsOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") { setExportOpen(false); setColumnsOpen(false); setFiltersOpen(false); }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  // Multi-select filters
  const [multiFilters, setMultiFilters] = useState({
    Dept: [],
    Level: [],
    MainIndustry: [],
    EmployeeSize: [],
    Country: [],
  });

  const predefinedFilters = useMemo(
    () => ({
      Dept: [
        "IT",
        "Sales and Marketing",
        "HR and Admin",
        "Finance",
        "Supply Chain",
        "Operation",
      ],
      Level: [
        "Owner",
        "C-Level",
        "Executive/Corporate",
        "Director",
        "Manager",
        "Staff",
      ],
      MainIndustry: [
        "Aerospace and Defense",
        "Apparel",
        "Agriculture and Forestry",
        "Automotive",
        "BFSI",
        "Business Services",
        "Chemicals",
        "Consumer Goods & Services",
        "Computer Hardware",
        "Computer Software",
        "Consumer Product Manufacturing",
        "Consumer Services",
        "Electronics",
        "eCommerce",
        "Energy & Utilities",
        "Energy and Environmental",
        "Food and Beverage",
        "Financial Services",
        "Furniture",
        "Government",
        "Hospitality, Leisure and Recreation",
        "Hospitals and Healthcare",
        "Insurance",
        "Manufacturing",
        "Marketing and Advertising",
        "Media and Entertainment",
        "Mining and Metals",
        "Non-Profit",
        "Oil and Gas",
        "Pharmaceuticals and Biotechnology",
        "Real Estate and Construction",
        "Retail",
        "Schools and Education",
        "Sports",
        "Telecommunications",
        "Transportation and Logistics",
        "Travel",
        "Wholesale and Distributor",
      ],
      EmployeeSize: [
        "1-10",
        "11-50",
        "51-200",
        "201-500",
        "501-1000",
        "1001-5000",
        "5000-10000",
        "10001+",
      ],
      Country: COUNTRIES,  
    }),
    []
  );

  const tableFields = [
  { key: "FirstName", label: "First Name" },
  { key: "LastName", label: "Last Name" },
  { key: "EmailID", label: "Email ID" },
  { key: "DirectNumber", label: "Direct Number" },

  { key: "JobTitle", label: "Job Title" },
  { key: "JobFunction", label: "Job Function" },
  { key: "Dept", label: "Department" },
  { key: "Level", label: "Level" },

  { key: "CompanyName", label: "Company Name" },
  { key: "CompanyNumber", label: "Company Number" },

  { key: "Industry", label: "Industry" },
  { key: "MainIndustry", label: "Main Industry" },

  { key: "EmployeeSize", label: "Employee Size" },
  { key: "ActiveEmployeeSize", label: "Active Employee Size" },
  { key: "RevenueSize", label: "Revenue Size" },

  { key: "Address1", label: "Address 1" },
  { key: "Address2", label: "Address 2" },
  { key: "City", label: "City" },
  { key: "State", label: "State" },
  { key: "PostalCode", label: "Postal Code" },
  { key: "Country", label: "Country" },

  { key: "WebsiteLink", label: "Website Link" },
  { key: "EmployeeLink", label: "Employee Link" },
  { key: "CompanyLink", label: "Company Link" },
];


  const [selectedFields, setSelectedFields] = useState([
    "FirstName",
    "LastName",
    "EmailID",
    "CompanyName",
    "Level",
  ]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 450);
    return () => clearTimeout(t);
  }, [search]);

  // Data fetch
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: [
      "users",
      page,
      debouncedSearch,
      sortField,
      sortOrder,
      multiFilters,
      selectedFields,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        search: debouncedSearch,
        sortField,
        sortOrder,
      });
      for (const key in multiFilters) {
        const values = multiFilters[key];
        if (values.length) params.append(key, values.join(","));
      }
      const res = await api.get(`/users?${params.toString()}`);
      return res.data; // { total, users: [...] }
    },
    staleTime: 30000,
    keepPreviousData: true,
  });

  const total = data?.total ?? 0;
  const hasNext = page * PAGE_SIZE < total;

  // Actions
  const handleSort = (fieldKey) => {
    if (sortField === fieldKey) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(fieldKey);
      setSortOrder("asc");
    }
  };

  const toggleFilterOption = (field, value) => {
    setMultiFilters((prev) => {
      const exists = prev[field].includes(value);
      return {
        ...prev,
        [field]: exists
          ? prev[field].filter((v) => v !== value)
          : [...prev[field], value],
      };
    });
  };

  const clearFilters = () => {
    setSearch("");
    setMultiFilters({ Dept: [], Level: [], MainIndustry: [], EmployeeSize: [], Country: [] });
    setPage(1);
  };

  const toggleField = (fieldKey) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((f) => f !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleExport = async (format, onlySelected = false) => {
    try {
      const params = new URLSearchParams({ search: debouncedSearch, format });
      for (const key in multiFilters) {
        if (multiFilters[key].length > 0) {
          params.append(key, multiFilters[key].join(","));
        }
      }
      let url = `/users/export?${params.toString()}`;
      if (onlySelected && selectedFields.length > 0) {
        url += `&fields=${encodeURIComponent(selectedFields.join(","))}`;
      }
      const res = await api.get(url, { responseType: "blob" });
      const fileURL = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = fileURL;
      link.setAttribute("download", `users.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Export failed: " + err.message);
    }
  };

  const activeFiltersCount = useMemo(
    () => Object.values(multiFilters).reduce((acc, arr) => acc + (arr?.length || 0), 0),
    [multiFilters]
  );

  const getLabelForField = (key) => tableFields.find((t) => t.key === key)?.label ?? key;

  return (
    <div className="db-root">
      {/* Topbar */}
      <header className="db-topbar" role="banner">
        {/* <div className="db-brand" aria-label="Only B2B People DB">
          <span className="db-logo" aria-hidden>OB</span>
          <span className="db-brand-text">Only B2B • People DB</span>
        </div> */}

        <div className="db-search" role="search">
          <Search className="db-search-icon" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, email…"
            aria-label="Search users"
          />
        </div>

        <div className="db-actions">
          <div className="db-dropdown" ref={columnsRef}>
            <button className="btn" onClick={() => setColumnsOpen((v) => !v)} aria-expanded={columnsOpen} aria-haspopup="menu">
              <Columns3 size={16} aria-hidden /> <span>Columns</span>
            </button>
            {columnsOpen && (
              <div className="menu" role="menu">
                <div className="menu-title">Show Columns</div>
                {tableFields.map((f) => (
                  <label key={f.key} className="menu-item">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(f.key)}
                      onChange={() => toggleField(f.key)}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="db-dropdown" ref={exportRef}>
            <button className="btn" onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen} aria-haspopup="menu">
              <Download size={16} aria-hidden /> <span>Export</span>
            </button>
            {exportOpen && (
              <div className="menu" role="menu">
                <button className="menu-button" onClick={() => { handleExport("csv", false); setExportOpen(false); }}>CSV — All fields</button>
                <button className="menu-button" onClick={() => { handleExport("csv", true); setExportOpen(false); }}>CSV — Selected fields</button>
                <hr />
                <button className="menu-button" onClick={() => { handleExport("xlsx", false); setExportOpen(false); }}>XLSX — All fields</button>
                <button className="menu-button" onClick={() => { handleExport("xlsx", true); setExportOpen(false); }}>XLSX — Selected fields</button>
              </div>
            )}
          </div>

          <button className="btn btn-ghost show-filters" onClick={() => setFiltersOpen(true)} aria-controls="mobile-filters" aria-expanded={filtersOpen}>
            <SlidersHorizontal size={16} aria-hidden />
            <span>Filters</span>
            {activeFiltersCount > 0 && <span className="badge">{activeFiltersCount}</span>}
          </button>
        </div>
      </header>

      {/* Layout */}
      <div className="db-layout">
        {/* Sidebar (desktop) */}
        <aside className="db-sidebar" aria-label="Filters sidebar">
          <FilterPanel
            predefinedFilters={predefinedFilters}
            multiFilters={multiFilters}
            toggleFilterOption={toggleFilterOption}
            clearFilters={clearFilters}
          />
        </aside>

        {/* Main */}
        <main className="db-main">
          {/* KPI cards */}
          <section className="kpi-grid" aria-label="Key metrics">
            <KPICard title="Total Users" value={data?.total ?? 0} loading={isLoading} />
            <KPICard title="Active Filters" value={activeFiltersCount} />
            <KPICard title="Page Size" value={PAGE_SIZE} />
          </section>

          {/* Active chips */}
          {activeFiltersCount > 0 && (
            <div className="chip-row" aria-label="Active filters">
              {Object.entries(multiFilters).map(([field, values]) =>
                values.map((v) => (
                  <span className="chip" key={`${field}-${v}`}>
                    {field}: {v}
                    <button className="chip-x" onClick={() => toggleFilterOption(field, v)} aria-label={`Remove ${v}`}>
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ))
              )}
              <button className="link" onClick={clearFilters}>Clear all</button>
            </div>
          )}

          {/* Data table / cards */}
          <section className="card">
            <div className="table-wrap" role="region" aria-label="Users table" aria-live="polite">
              <table className="db-table">
                <thead>
                  <tr>
                    {selectedFields.map((fieldKey) => {
                      const f = tableFields.find((x) => x.key === fieldKey);
                      if (!f) return null;
                      const isSorted = sortField === f.key;
                      return (
                        <th key={f.key} onClick={() => handleSort(f.key)} title="Click to sort" scope="col">
                          <span className="th-inner">
                            {f.label}
                            {isSorted ? (
                              sortOrder === "asc" ? <ChevronUp size={14} aria-label="Ascending" /> : <ChevronDown size={14} aria-label="Descending" />
                            ) : null}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {isLoading || isFetching ? (
                    <SkeletonRows cols={selectedFields.length} />
                  ) : error ? (
                    <tr>
                      <td colSpan={selectedFields.length} className="error">Error loading data</td>
                    </tr>
                  ) : (
                    data?.users?.map((u) => (
                      <tr key={u._id}>
                        {/* {selectedFields.map((k) => (
                          <td key={k} data-label={getLabelForField(k)}>
                            {renderCell(u[k])}
                          </td>
                        ))} */}
                        {selectedFields.map((k) => (
                          <td key={k} data-label={getLabelForField(k)}>
                            {renderCell(u[k], k)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <div>Page <strong>{page}</strong> {total > 0 && <span className="muted">of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>}</div>
              <div className="pager">
                <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft size={16} aria-hidden /> Prev
                </button>
                <button className="btn" onClick={() => setPage((p) => p + 1)} disabled={!hasNext}>
                  Next <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Mobile slide-over filters */}
      {filtersOpen && (
        <div className="drawer" id="mobile-filters">
          <div className="drawer-backdrop" onClick={() => setFiltersOpen(false)} />
          <div className="drawer-panel" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="drawer-head">
              <h3>Filters</h3>
              <button className="icon-btn" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={18} aria-hidden /></button>
            </div>
            <div className="drawer-body">
              <FilterPanel
                predefinedFilters={predefinedFilters}
                multiFilters={multiFilters}
                toggleFilterOption={toggleFilterOption}
                clearFilters={clearFilters}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, loading }) {
  return (
    <div className="kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{loading ? <span className="pulse">…</span> : value}</div>
    </div>
  );
}

function SkeletonRows({ cols = 5, rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j}><div className="skl" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

function FilterPanel({ predefinedFilters, multiFilters, toggleFilterOption, clearFilters }) {
  const [open, setOpen] = useState({
    Dept: false,
    Level: false,
    MainIndustry: false,
    EmployeeSize: false,
    Country: false,
  });

  const toggleOpen = (field) =>
    setOpen((o) => ({ ...o, [field]: !o[field] }));

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Filters</h3>
        <button className="link" onClick={clearFilters}>Clear all</button>
      </div>

      {Object.entries(predefinedFilters).map(([field, options]) => {
        const isOpen = open[field];
        const selectedCount = multiFilters[field]?.length ?? 0;
        const sectionId = `filter-${field}`;

        return (
          <div key={field} className="filter-block">
            <button
              className="filter-toggle"
              aria-expanded={isOpen}
              aria-controls={sectionId}
              onClick={() => toggleOpen(field)}
              type="button"
            >
              <span className="filter-label">{field}</span>
              {selectedCount > 0 && <span className="badge">{selectedCount}</span>}
              <span className="chev" aria-hidden>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>

            {isOpen && (
              field === "Country" ? (
          <CountrySearchableOptions
            sectionId={sectionId}
            options={options}
            selected={multiFilters[field] ?? []}
            onToggle={(v) => toggleFilterOption(field, v)}
          />
        ) : (
          <div id={sectionId} className="filter-options" role="region" aria-label={`${field} options`}>
            {options.map((opt) => (
              <label key={opt} className="option">
                <input
                  type="checkbox"
                  checked={multiFilters[field]?.includes(opt)}
                  onChange={() => toggleFilterOption(field, opt)}
                />
                <span>{opt}</span>
              </label>
            ))}

            {selectedCount > 0 && (
              <div className="chip-row">
                {multiFilters[field].map((v) => (
                  <span className="chip" key={v}>
                    {v}
                    <button
                      className="chip-x"
                      onClick={() => toggleFilterOption(field, v)}
                      aria-label={`Remove ${v}`}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )
            )}
          </div>
        );
      })}
      

      <div className="tips">
        <strong>Tips</strong>
        <ul>
          <li>Click a column header to sort.</li>
          <li>Use the top search to find across all fields.</li>
          <li>Export all fields or only the selected columns.</li>
        </ul>
      </div>
    </div>
  );
}

function CountrySearchableOptions({ sectionId, options, selected, onToggle }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((c) => c.toLowerCase().includes(s)) : options;
  }, [q, options]);

  return (
    <div id={sectionId} role="region" aria-label="Country options">
      <div className="country-search">
        <input
          placeholder="Search country…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search country"
        />
      </div>

      <div className="filter-options">
        {filtered.map((opt) => (
          <label key={opt} className="option">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => onToggle(opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="chip-row">
          {selected.map((v) => (
            <span className="chip" key={v}>
              {v}
              <button
                className="chip-x"
                onClick={() => onToggle(v)}
                aria-label={`Remove ${v}`}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}



// function renderCell(value) {
//   if (value === null || value === undefined) return "—";
//   if (typeof value === "string") {
//     const isLink = /^(https?:\/\/|www\.)/i.test(value);
//     if (isLink) {
//       const href = value.startsWith("http") ? value : `https://${value}`;
//       return (
//         <a href={href} target="_blank" rel="noreferrer" className="cell-link">
//           {value}
//         </a>
//       );
//     }
//   }
//   return String(value);
// }

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
  if (digits.length === 0) return "••••";
  const last = digits.slice(-4);
  // show country code if present (e.g., +1, +44), then mask middle entirely
  const ccMatch = s.match(/^\+\d{1,3}/);
  const cc = ccMatch ? ccMatch[0] + " " : "";
  return `${cc}••••••${last}`;
}

function renderCell(value, fieldKey) {
  if (value === null || value === undefined) return "—";

  // Mask specific fields
  if (fieldKey === "EmailID") {
    return <span className="masked">{maskEmail(String(value))}</span>;
  }
  if (fieldKey === "DirectNumber" || fieldKey === "CompanyNumber") {
    return <span className="masked">{maskPhone(value)}</span>;
  }

  // Linkify non-sensitive strings
  if (typeof value === "string") {
    const isLink = /^(https?:\/\/|www\.)/i.test(value);
    if (isLink) {
      const href = value.startsWith("http") ? value : `https://${value}`;
      return (
        <a href={href} target="_blank" rel="noreferrer" className="cell-link">
          {value}
        </a>
      );
    }
  }
  return String(value);
}
