import { useEffect, useMemo, useState, useRef } from "react";
import "./App.css";
import Login from "./Login";
import ParticleCanvas from "./ParticleCanvas";

const defaultAnalysis = {
  category: "Awaiting analysis",
  severity: "Not calculated",
  impact: "Submit a real civic issue to generate a structured AI report.",
  suggestions: [],
  authorities: [],
  complaint_format: "",
  innovation_ideas: [],
  best_hackathon_solution: "",
  smart_city_solutions: [],
  emergency_contacts: [],
  complaint_links: [],
};

const sectorOptions = [
  "Transportation",
  "Healthcare",
  "Education",
  "Environment",
  "Sanitation",
  "Public Safety",
  "Water Supply",
  "Electricity",
];

const sectorIdeaMap = {
  Transportation: "Civic Heatmap Engine",
  Healthcare: "Emergency Signal Detector",
  Education: "AI Complaint Router",
  Environment: "Civic Heatmap Engine",
  Sanitation: "Proof-of-Resolution Tracker",
  "Public Safety": "Emergency Signal Detector",
  "Water Supply": "Proof-of-Resolution Tracker",
  Electricity: "AI Complaint Router",
};

const openProblemKeywords = ["shelter", "display", "dust", "pipeline", "route"];

const loadingSteps = [
  "Analyzing civic issue",
  "Detecting severity",
  "Generating authorities",
  "Preparing complaint format",
];

const shouldStayOpenForTeams = (report, index) => {
  const text = `${report.title} ${report.description}`.toLowerCase();
  return index % 4 === 0 || openProblemKeywords.some((keyword) => text.includes(keyword));
};

const getBestIdeaTitle = (report) => {
  if (report.analysis?.best_hackathon_solution) {
    return report.analysis.best_hackathon_solution;
  }

  const text = `${report.title} ${report.description}`.toLowerCase();

  if (text.includes("unsafe") || text.includes("accident") || text.includes("fire")) {
    return "Emergency Signal Detector";
  }

  if (text.includes("garbage") || text.includes("leak") || text.includes("drain")) {
    return "Proof-of-Resolution Tracker";
  }

  return sectorIdeaMap[report.sector] || "AI Complaint Router";
};

const blankIdeaForm = {
  title: "",
  sector: "",
  problem_title: "",
  team: "",
  host: "",
  status: "Submitted",
  score: 88,
  summary: "",
  why_selected: "",
  implementation: "",
  image_url: "",
};

const normalizeName = (value = "") => value.trim().toLowerCase();

function App() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    sector: "",
    location: "",
  });
  const [imagePreview, setImagePreview] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [hackathonIdeas, setHackathonIdeas] = useState([]);
  const [selectedSector, setSelectedSector] = useState("All");
  const [openSector, setOpenSector] = useState("");
  const [expandedSector, setExpandedSector] = useState("");
  const [ideaForm, setIdeaForm] = useState(blankIdeaForm);
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState("login");
  const [navigateStage, setNavigateStage] = useState("");
  const [pendingStage, setPendingStage] = useState("");
  const [showGate, setShowGate] = useState(false);
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [selectedProblemForIdea, setSelectedProblemForIdea] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const appRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isIdeaSaving, setIsIdeaSaving] = useState(false);
  const [error, setError] = useState("");
  const [ideaMessage, setIdeaMessage] = useState("");

  const openWorld = (mode) => {
    if (!user) {
      setPendingStage(mode);
      setViewMode("login");
      return;
    }

    setNavigateStage(mode);
    setShowGate(true);
    window.setTimeout(() => {
      setViewMode(mode);
      setShowGate(false);
    }, 300);
  };

  const closeWorld = () => {
    setViewMode("home");
    setExpandedSector("");
    setOpenSector("");
    setSelectedSector("All");
  };

  const handleLogin = (username) => {
    const u = { name: username };
    setUser(u);
    localStorage.setItem("pp_user", JSON.stringify(u));
    setPendingStage("");
    setViewMode("home");
  };

  const openIdeaFromProblem = (report) => {
    // If not logged in, send to login first
    if (!user) {
      setViewMode("login");
      // preserve selection so user can continue after login
      setSelectedProblemForIdea(report);
      return;
    }

    setExpandedSector("");

    // prefill idea form and switch to hackathon world
    setIdeaForm((cur) => ({ ...cur, problem_title: report.title, sector: report.sector }));
    setViewMode("hackathon");
    // small delay then scroll to idea form
    window.setTimeout(() => {
      document.getElementById("hackathon-idea-form")?.scrollIntoView({ behavior: "smooth" });
    }, 200);
  };

  const markBestIdea = (id) => {
    if (!user) {
      setViewMode("login");
      return;
    }
    const current = hackathonIdeas.find((it) => it.id === id);
    const newMark = normalizeName(current?.voted_by) !== normalizeName(user.name);

    // call backend to persist user vote
    fetch(`http://127.0.0.1:5000/ideas/${encodeURIComponent(id)}/mark_best`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark: newMark, user_name: user.name }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.success && data.idea) {
          // replace idea in state
          setHackathonIdeas((items) => {
            const updated = items.map((it) => (it.id === data.idea.id ? { ...it, ...data.idea } : it));
            // resort
            updated.sort((a, b) => {
              const aScore = (a.user_top ? 1000 : 0) + (a.ai_top ? 100 : (a.score || 0));
              const bScore = (b.user_top ? 1000 : 0) + (b.ai_top ? 100 : (b.score || 0));
              return bScore - aScore;
            });
            return updated;
          });
        }
      })
      .catch(() => {
        // fallback to local toggle if backend fails
        setHackathonIdeas((items) => {
          const newItems = items.map((it) => (
            it.id === id
              ? { ...it, user_top: newMark, voted_by: newMark ? user.name : "" }
              : it
          ));
          newItems.sort((a, b) => {
            const aScore = (a.user_top ? 1000 : 0) + (a.ai_top ? 100 : (a.score || 0));
            const bScore = (b.user_top ? 1000 : 0) + (b.ai_top ? 100 : (b.score || 0));
            return bScore - aScore;
          });
          return newItems;
        });
      });
  };

  useEffect(() => {
    // after login, if user was trying to open an idea from a problem, continue flow
    if (user && selectedProblemForIdea) {
      const rpt = selectedProblemForIdea;
      setSelectedProblemForIdea(null);
      // slight delay so login view has time to hide
      window.setTimeout(() => openIdeaFromProblem(rpt), 120);
    }
  }, [user, selectedProblemForIdea]);

  // pointer-parallax only when inside a world (not home)
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;

    const onMove = (e) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) || 0;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) || 0;
      const bg = el.querySelector('.ai-grid-bg');
      const rings = el.querySelector('.signal-rings');
      if (bg) bg.style.transform = `translate(${x * 18}px, ${y * 12}px) scale(${viewMode !== 'home' ? 1.04 : 1})`;
      if (rings) rings.style.transform = `translate(${x * 26}px, ${y * 10}px) rotate(${x * 6}deg)`;
    };

    if (viewMode !== 'home') {
      window.addEventListener('mousemove', onMove);
    }

    return () => window.removeEventListener('mousemove', onMove);
  }, [viewMode]);

  const analysis = result?.analysis || defaultAnalysis;
  const severityLevel = analysis.severity?.toLowerCase().includes("high")
    ? "high"
    : analysis.severity?.toLowerCase().includes("critical")
      ? "high"
      : analysis.severity?.toLowerCase().includes("low")
        ? "low"
        : "medium";

  const aiScore = useMemo(() => {
    if (!result) {
      return 0;
    }

    const base = severityLevel === "high" ? 92 : severityLevel === "medium" ? 84 : 76;
    return Math.min(98, base + Math.min(6, analysis.suggestions.length));
  }, [analysis.suggestions.length, result, severityLevel]);

  const civicImpact =
    severityLevel === "high" ? "Severe" : severityLevel === "medium" ? "Moderate" : "Controlled";

  const sectorStats = useMemo(() => {
    return history.reduce((stats, item) => {
      const key = item.sector || "Other";
      stats[key] = (stats[key] || 0) + 1;
      return stats;
    }, {});
  }, [history]);

  const locationStats = useMemo(() => {
    return Object.entries(
      history.reduce((stats, item) => {
        const key = item.location || "Unknown area";
        stats[key] = (stats[key] || 0) + 1;
        return stats;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [history]);

  const maxSectorCount = Math.max(1, ...Object.values(sectorStats));

  const majorProblems = useMemo(() => {
    return Object.entries(sectorStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [sectorStats]);

  const groupedReports = useMemo(() => {
    return history.reduce((groups, report) => {
      const sector = report.sector || "General";
      groups[sector] = groups[sector] || [];
      groups[sector].push(report);
      return groups;
    }, {});
  }, [history]);

  const visibleSectorEntries = useMemo(() => {
    const entries = Object.entries(groupedReports);

    if (selectedSector === "All") {
      return entries;
    }

    return entries.filter(([sector]) => sector === selectedSector);
  }, [groupedReports, selectedSector]);

  const expandedSectorReports = expandedSector ? groupedReports[expandedSector] || [] : [];

  const recognizedIdeasByProblem = useMemo(() => {
    return hackathonIdeas.reduce((ideas, idea) => {
      const key = idea.problem_title?.toLowerCase();

      if (key) {
        ideas[key] = idea;
      }

      return ideas;
    }, {});
  }, [hackathonIdeas]);

  const recognizedIdeasBySector = useMemo(() => {
    return hackathonIdeas.reduce((ideas, idea) => {
      const key = idea.sector || "General";
      ideas[key] = ideas[key] || [];
      ideas[key].push(idea);
      return ideas;
    }, {});
  }, [hackathonIdeas]);

  const sortedIdeas = useMemo(() => {
    const out = [...hackathonIdeas];
    out.sort((a, b) => {
      const aScore = (a.user_top ? 1000 : 0) + (a.ai_top ? 100 : (a.score || 0));
      const bScore = (b.user_top ? 1000 : 0) + (b.ai_top ? 100 : (b.score || 0));
      return bScore - aScore;
    });
    return out;
  }, [hackathonIdeas]);

  const myReports = useMemo(() => {
    const name = normalizeName(user?.name);
    return name ? history.filter((report) => normalizeName(report.submitted_by) === name) : [];
  }, [history, user]);

  const myIdeas = useMemo(() => {
    const name = normalizeName(user?.name);
    return name ? hackathonIdeas.filter((idea) => normalizeName(idea.submitted_by) === name) : [];
  }, [hackathonIdeas, user]);

  const myVotes = useMemo(() => {
    const name = normalizeName(user?.name);
    return name ? hackathonIdeas.filter((idea) => normalizeName(idea.voted_by) === name) : [];
  }, [hackathonIdeas, user]);

  const getRecognizedIdea = (report) => {
    return (
      recognizedIdeasByProblem[report.title?.toLowerCase()] ||
      recognizedIdeasBySector[report.sector]?.[0] ||
      null
    );
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [reportsResponse, ideasResponse] = await Promise.all([
          fetch("http://127.0.0.1:5000/reports"),
          fetch("http://127.0.0.1:5000/ideas"),
        ]);

        const reportsData = await reportsResponse.json();
        const ideasData = await ideasResponse.json();

        if (reportsData.success) {
          setHistory(reportsData.reports);
        }

        if (ideasData.success) {
          setHackathonIdeas(ideasData.ideas);
        }
      } catch {
        setError("Backend is not reachable. Start Flask to load saved public reports.");
      }
    };

    loadDashboardData();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setImagePreview("");
      return;
    }

    setImagePreview(URL.createObjectURL(file));
  };

  const handleIdeaChange = (e) => {
    setIdeaForm({
      ...ideaForm,
      [e.target.name]: e.target.value,
    });
  };

  const analyzeProblem = async () => {
    setError("");

    if (!formData.title.trim() || !formData.description.trim() || !formData.location.trim()) {
      setError("Please add a title, description, and location before analysis.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...formData, submitted_by: user?.name || "" }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI analysis failed. Please try again.");
      }

      const savedReport = data.report || {
        id: crypto.randomUUID(),
        imagePreview,
        ...formData,
        analysis: data.analysis,
        createdAt: new Date().toLocaleString(),
      };
      const report = { ...savedReport, imagePreview, submitted_by: savedReport.submitted_by || user?.name || "" };

      setResult(report);
      setShowHistory(true);
      setHistory((items) => [report, ...items.filter((item) => item.id !== report.id)]);
      window.setTimeout(() => {
        document.getElementById("ai-report-result")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      setError(err.message || "Backend error. Start Flask on port 5000 and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitIdea = async () => {
    setIdeaMessage("");

    if (!ideaForm.title.trim() || !ideaForm.sector || !ideaForm.problem_title.trim() || !ideaForm.summary.trim()) {
      setIdeaMessage("Add idea title, sector, problem title, and summary.");
      return;
    }

    setIsIdeaSaving(true);

    try {
      // lightweight client-side AI scoring: longer, more detailed summaries score higher
      const ai_score = Math.min(100, (ideaForm.summary || "").length);
      const ai_top = ai_score > 120;

      const response = await fetch("http://127.0.0.1:5000/ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...ideaForm,
          team: ideaForm.team || `${user?.name || "Student"}'s team`,
          ai_score,
          ai_top,
          submitted_by: user?.name || "",
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not save hackathon idea.");
      }

      // ensure client-side flags preserved if backend didn't
      const incoming = {
        ...(data.idea || {}),
        ai_top: data.idea?.ai_top || ai_top,
        ai_score: data.idea?.ai_score || ai_score,
        submitted_by: data.idea?.submitted_by || user?.name || "",
      };
      setHackathonIdeas((items) => [incoming, ...items]);
      setIdeaForm(blankIdeaForm);
      setIdeaMessage("Hackathon idea posted and added to the recognition board.");
    } catch (err) {
      setIdeaMessage(err.message || "Backend error while saving idea.");
    } finally {
      setIsIdeaSaving(false);
    }
  };

  const scrollToReport = () => {
    document.getElementById("report")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={appRef} className={`app ${viewMode !== "home" ? "in-world" : ""}`}>
      <ParticleCanvas active={viewMode !== 'home'} />
      {viewMode === "home" && (
        <section className="hero">
          <div className="ai-grid-bg" />
          <div className="signal-rings">
            <span />
            <span />
            <span />
          </div>
          <div className="hero-content">
            <p className="eyebrow ai-live">Civic issues to hackathon ideas</p>
            <h1>Issue2Innovation AI</h1>
            <p>
              Submit local problems, generate AI-backed civic reports, and turn real public issues
              into hackathon-ready innovation ideas.
            </p>
            <div className="hero-actions">
              <button type="button" className="hero-cta" onClick={() => openWorld("report")}>Submit a Problem</button>
              <button type="button" className="hero-cta secondary" onClick={() => openWorld("hackathon")}>Hackathon Ideas</button>
            </div>
          </div>
        </section>
      )}

      {showGate && (
        <div className={`world-gate ${navigateStage ? `world-gate-${navigateStage}` : ""}`}>
          <div className="world-gate-panel">
            <span>{navigateStage === "hackathon" ? "Entering Hackathon Universe" : "Opening Problem Portal"}</span>
            <p>One second while the new world assembles.</p>
          </div>
        </div>
      )}

      {viewMode === "login" && (
        <div className="login-root">
          <Login onLogin={handleLogin} />
        </div>
      )}

      {viewMode !== "home" && viewMode !== "login" && (
        <div className="page-panel page-panel-header panel-active">
          <div className="page-panel-header-inner">
            <button type="button" className="page-back" onClick={closeWorld}>← Back to home</button>
            <div className="page-panel-title">
              <p className="eyebrow">{viewMode === "hackathon" ? "Hackathon lab" : "Reporting desk"}</p>
              <h2>{viewMode === "hackathon" ? "Explore Hackathon Ideas" : "Submit a Problem"}</h2>
            </div>
          </div>
          <div className="personal-strip" aria-label="Your workspace summary">
            <div className="personal-name">
              <span>Your workspace</span>
              <strong>{user?.name}</strong>
            </div>
            <div>
              <span>Problems submitted</span>
              <strong>{myReports.length}</strong>
            </div>
            <div>
              <span>Hackathon ideas</span>
              <strong>{myIdeas.length}</strong>
            </div>
            <div>
              <span>Best idea votes</span>
              <strong>{myVotes.length}</strong>
            </div>
          </div>
        </div>
      )}

      <main className={`workspace page-panel ${viewMode === "report" ? "panel-active" : "panel-hidden"}`}>
        <section className="report-section" id="report">
          <div className="section-heading">
            <p className="eyebrow">New report</p>
            <h2>Report a Problem</h2>
          </div>

          <label>
            Problem Title
            <input
              type="text"
              name="title"
              placeholder="Example: Open drainage near bus stop"
              value={formData.title}
              onChange={handleChange}
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              placeholder="Describe who is affected, when it happens, and any visible risk..."
              value={formData.description}
              onChange={handleChange}
            />
          </label>

          <div className="field-grid">
            <label>
              Sector
              <select name="sector" value={formData.sector} onChange={handleChange}>
                <option value="">Select sector</option>
                {sectorOptions.map((sector) => (
                  <option value={sector} key={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Location
              <input
                type="text"
                name="location"
                placeholder="Area, ward, landmark"
                value={formData.location}
                onChange={handleChange}
              />
            </label>
          </div>

          <label className="upload-box">
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Uploaded problem preview" />
                <strong>AI Visual Evidence Ready</strong>
              </>
            ) : (
              <span>Upload issue photo for preview</span>
            )}
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="button" onClick={analyzeProblem} disabled={isLoading}>
            {isLoading ? "Analyzing..." : "Analyze Problem"}
          </button>
        </section>

      {result && showHistory && (
        <aside className="insights-panel" aria-label="Problem insights">
          <div className="mini-card">
            <p className="eyebrow">Reports</p>
            <strong>{history.length}</strong>
            <span>saved in SQLite database</span>
          </div>

          <div className="mini-card">
            <p className="eyebrow">Trending Problems</p>
            {Object.keys(sectorStats).length === 0 ? (
              <p>No reports yet</p>
            ) : (
              <div className="chart">
                {Object.entries(sectorStats).map(([sector, count]) => (
                  <div className="chart-row" key={sector}>
                    <span>{sector}</span>
                    <div>
                      <i style={{ width: `${(count / maxSectorCount) * 100}%` }} />
                    </div>
                    <b>{count}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mini-card">
            <p className="eyebrow">Most Affected Areas</p>
            {locationStats.length === 0 ? (
              <p>Areas appear after reports are analyzed.</p>
            ) : (
              <ul className="area-list">
                {locationStats.map(([location, count]) => (
                  <li key={location}>
                    <span>{location}</span>
                    <b>{count}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mini-card">
            <p className="eyebrow">Major Problems</p>
            {majorProblems.length === 0 ? (
              <p>Sector pressure appears after reports load.</p>
            ) : (
              <ul className="area-list">
                {majorProblems.map(([sector, count]) => (
                  <li key={sector}>
                    <span>{sector}</span>
                    <b>{count} reports</b>
                  </li>
                ))}
              </ul>
            )}
          </div>


        </aside>
      )}
    </main>

      <section className={`sector-pool-section page-panel ${viewMode === "hackathon" ? "panel-active" : "panel-hidden"}`}>
        <div className="section-heading pool-heading">
          <div>
            <p className="eyebrow">People's problem pool</p>
            <h2>Sector-wise problems and hackathon picks</h2>
          </div>

          <label className="compact-select">
            Filter sector
            <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}>
              <option value="All">All sectors</option>
              {Object.keys(groupedReports).map((sector) => (
                <option value={sector} key={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="sector-grid">
          {visibleSectorEntries.map(([sector, reports]) => (
            <article className={`sector-box ${openSector === sector ? "is-open" : ""}`} key={sector}>
              <button
                type="button"
                className="sector-box-head"
                onClick={() => setOpenSector(openSector === sector ? "" : sector)}
              >
                <div>
                  <span>{reports.length} public reports</span>
                  <h3>{sector}</h3>
                </div>
                <b>{openSector === sector ? "-" : "+"}</b>
              </button>

              <div className="sector-card-actions">
                <button
                  type="button"
                  className="sector-fullview-button"
                  onClick={() => setExpandedSector(expandedSector === sector ? "" : sector)}
                >
                  {expandedSector === sector ? "Close sector view" : "View full sector"}
                </button>
              </div>

              {openSector === sector && <div className="sector-scan">AI scanning this sector</div>}

              <div className={`problem-stack ${openSector === sector ? "show" : ""}`}>
                {reports.slice(0, 4).map((report) => (
                  <div className="problem-row" key={report.id}>
                    <button type="button" onClick={() => {
                      setResult(report);
                      setViewMode("report");
                      window.setTimeout(() => {
                        document.getElementById("ai-report-result")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }}>
                      <strong>{report.title}</strong>
                      <small>{report.location}</small>
                    </button>
                    <p className="report-snippet">{report.description}</p>
                    <div className="problem-actions">
                      <button type="button" className="give-idea-btn" onClick={() => openIdeaFromProblem(report)}>Give your idea</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="hackathon-portal">
          <div className="section-heading">
            <p className="eyebrow">Hackathon lab</p>
            <h2>Post a new hackathon idea</h2>
          </div>

          <div id="hackathon-idea-form" className="idea-submit-panel">
            <div className="idea-panel-header">
              <p className="eyebrow">Build with the problem</p>
              <h3>Share your transformative idea</h3>
              <p>Submit a hackathon concept that turns local problems into demo-ready solutions.</p>
            </div>

            <label>
              Idea title
              <input
                type="text"
                name="title"
                placeholder="Example: Community flood alert bot"
                value={ideaForm.title}
                onChange={handleIdeaChange}
              />
            </label>

            <div className="field-grid">
              <select name="sector" value={ideaForm.sector} onChange={handleIdeaChange}>
                <option value="">Select sector</option>
                {Object.keys(groupedReports).map((sector) => (
                  <option value={sector} key={sector}>{sector}</option>
                ))}
              </select>
              <input
                type="text"
                name="problem_title"
                placeholder="Problem title from report"
                value={ideaForm.problem_title}
                onChange={handleIdeaChange}
              />
            </div>

            <div className="field-grid">
              <select name="status" value={ideaForm.status} onChange={handleIdeaChange}>
                <option value="Submitted">Submitted</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Recognized">Recognized</option>
                <option value="Implemented demo">Implemented demo</option>
              </select>
              <input
                type="number"
                name="score"
                min="1"
                max="100"
                placeholder="Selection score"
                value={ideaForm.score}
                onChange={handleIdeaChange}
              />
            </div>

            <textarea
              name="summary"
              placeholder="What does this hackathon idea solve?"
              value={ideaForm.summary}
              onChange={handleIdeaChange}
            />

            <textarea
              name="why_selected"
              placeholder="Why was this idea selected or recognized?"
              value={ideaForm.why_selected}
              onChange={handleIdeaChange}
            />

            <input
              type="url"
              name="image_url"
              placeholder="Real project/demo image URL"
              value={ideaForm.image_url}
              onChange={handleIdeaChange}
            />

            {ideaForm.image_url && (
              <img className="idea-image-preview" src={ideaForm.image_url} alt="Hackathon idea preview" />
            )}

            {ideaMessage && <p className="idea-message">{ideaMessage}</p>}

            <button type="button" onClick={submitIdea} disabled={isIdeaSaving}>
              {isIdeaSaving ? "Posting Idea..." : "Post Hackathon Idea"}
            </button>
          </div>

          <aside className="insights-panel hackathon-insights">
            <div className="mini-card spotlight-card">
              <div>
                <p className="eyebrow">Issue2Innovation board</p>
                <h3>Ideas moving from civic pain to prototype</h3>
                <span>Hackathon concepts built from real public reports.</span>
              </div>
              <div className="spotlight-count">
                <strong>{hackathonIdeas.length}</strong>
                <small>{hackathonIdeas.length === 1 ? "active idea" : "active ideas"}</small>
              </div>
            </div>

            <div className="idea-list">
              {sortedIdeas.slice(0, 5).map((idea) => (
                <article key={idea.id || idea.title}>
                  {idea.image_url && <img src={idea.image_url} alt={idea.title} />}
                  <span>{idea.status} | {idea.sector}{normalizeName(idea.submitted_by) === normalizeName(user?.name) ? " | Submitted by you" : ""}</span>
                  <h3>{idea.title}</h3>
                  <p>{idea.summary}</p>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="mark-best-btn" onClick={() => markBestIdea(idea.id)}>
                      {normalizeName(idea.voted_by) === normalizeName(user?.name) ? 'Remove my vote' : 'Mark best'}
                    </button>
                    {idea.ai_top && <small className="ai-badge">AI top</small>}
                    {normalizeName(idea.voted_by) === normalizeName(user?.name) && <small className="user-badge">Your vote</small>}
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {isLoading && (
        <section className="ai-loading" role="status" aria-live="polite">
          <div className="ai-loader-card">
            <div className="ai-orbit" />
            <p className="eyebrow">Gemini civic analysis</p>
            <h2>Analyzing your report</h2>
            <div className="loading-steps">
              {loadingSteps.map((step, index) => (
                <span style={{ animationDelay: `${index * 0.22}s` }} key={step}>
                  {step}
                  <i>...</i>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}


      {viewMode === "hackathon" && expandedSector && (
        <div className="sector-overlay" role="dialog" aria-modal="true">
          <div className="sector-overlay-backdrop" onClick={() => setExpandedSector("")} />
          <div className="sector-overlay-panel">
            <div className="sector-overlay-header">
              <div>
                <p className="eyebrow">Sector deep dive</p>
                <h2>{expandedSector}</h2>
                <p className="overlay-subtitle">
                  {expandedSectorReports.length} public report{expandedSectorReports.length === 1 ? "" : "s"} in this sector
                </p>
              </div>
              <button type="button" className="close-sector-overlay" onClick={() => setExpandedSector("")}>Close</button>
            </div>

            <div className="sector-overlay-grid">
              {expandedSectorReports.map((report, index) => {
                const isOpen = shouldStayOpenForTeams(report, index);
                const suggestedIdeaTitle = getBestIdeaTitle(report);
                const suggestedIdea = hackathonIdeas.find((idea) => idea.title === suggestedIdeaTitle);
                const recognizedIdea = getRecognizedIdea(report);

                return (
                  <article className="sector-overlay-card" key={report.id}>
                    <div className="overlay-card-head">
                      <div>
                        <strong>{report.title}</strong>
                        <small>{report.location}</small>
                      </div>
                      <button
                        type="button"
                        className="overlay-select-report"
                        onClick={() => {
                          setResult(report);
                          setExpandedSector("");
                          setViewMode("report");
                          window.setTimeout(() => {
                            document.getElementById("ai-report-result")?.scrollIntoView({ behavior: "smooth" });
                          }, 100);
                        }}
                      >
                        Show report
                      </button>
                    </div>

                    <p>{report.description}</p>

                    <div className={`hackathon-match ${recognizedIdea ? "" : isOpen ? "open-challenge" : ""}`}>
                      <span>{recognizedIdea ? "AI recommended hackathon idea" : isOpen ? "Open hackathon challenge" : "AI recommended hackathon idea"}</span>
                      <h4>{recognizedIdea ? suggestedIdeaTitle : isOpen ? "No solution selected yet" : suggestedIdeaTitle}</h4>
                      <p>
                        {recognizedIdea
                          ? suggestedIdea?.summary || "Chosen from the problem sector, urgency, and keywords in the report."
                          : isOpen
                          ? "A student team can pick this public problem and build their own idea."
                          : suggestedIdea?.summary || "Chosen from the problem sector, urgency, and keywords in the report."
                        }
                      </p>
                    </div>

                    <div className="overlay-idea-action">
                      <button type="button" className="give-idea-btn" onClick={() => openIdeaFromProblem(report)}>Give your idea</button>
                    </div>
                    {recognizedIdea && (
                      <div className="recognized-solution overlay-solution">
                        {recognizedIdea.image_url && (
                          <img src={recognizedIdea.image_url} alt={recognizedIdea.title} />
                        )}
                        <div>
                          <span>{recognizedIdea.status} by {recognizedIdea.team}</span>
                          <h4>{recognizedIdea.title}</h4>
                          <p>{recognizedIdea.why_selected}</p>
                          <small>{recognizedIdea.host} | Score {recognizedIdea.score}%</small>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewMode === "report" && result && (
        <section className="result-section" id="ai-report-result">
          <div className="section-heading">
            <p className="eyebrow">AI analysis</p>
            <div className="analysis-title">
              <h2>{result.title}</h2>
              <span>AI report ready</span>
            </div>
          </div>

          <div className="result-layout">
            <div className="result-card">
              <div className="score-grid">
                <div>
                  <span>Category</span>
                  <strong>{analysis.category}</strong>
                </div>
                <div className={`severity-tile severity-${severityLevel}`}>
                  <span>Severity</span>
                  <strong>{analysis.severity}</strong>
                </div>
                <div>
                  <span>Location</span>
                  <strong>{result.location}</strong>
                </div>
              </div>

              <div className="ai-score-grid">
                <div>
                  <span>AI Confidence Score</span>
                  <strong>{aiScore}%</strong>
                </div>
                <div>
                  <span>Response Priority</span>
                  <strong>{severityLevel.toUpperCase()}</strong>
                </div>
                <div>
                  <span>Estimated Civic Impact</span>
                  <strong>{civicImpact}</strong>
                </div>
              </div>

              <h3>Impact</h3>
              <p>{analysis.impact}</p>

              <h3>AI Suggestions</h3>
              <ul>
                {analysis.suggestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>

              <h3>Authorities to Contact</h3>
              <ul>
                {analysis.authorities.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>

              <h3>Innovation Ideas</h3>
              <ul>
                {analysis.innovation_ideas.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>

              <h3>Smart City Solutions</h3>
              <ul>
                {analysis.smart_city_solutions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="action-card">
              {result.imagePreview && <img src={result.imagePreview} alt="Reported issue" />}

              <div className="map-preview">
                <p className="eyebrow">Affected Area Map Preview</p>
                <iframe
                  title="Affected area map preview"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    result.location || "India",
                  )}&z=13&output=embed`}
                  loading="lazy"
                />
                <span>{result.location}</span>
              </div>

              <h3>Complaint Actions</h3>
              <div className="link-list">
                {analysis.complaint_links.map((link) => (
                  <a href={link.url} target="_blank" rel="noreferrer" key={link.label}>
                    {link.label}
                  </a>
                ))}
              </div>

              <h3>Emergency Contacts</h3>
              <ul className="contact-list">
                {analysis.emergency_contacts.map((contact) => (
                  <li key={contact.phone}>
                    <span>{contact.label}</span>
                    <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                  </li>
                ))}
              </ul>

              <h3>Complaint Format</h3>
              <pre>{analysis.complaint_format}</pre>
            </div>
          </div>
        </section>
      )}

      {viewMode === "report" && showHistory && (
        <section className="history-section">
          <div className="section-heading">
            <p className="eyebrow">Database preview</p>
            <h2>Problem History</h2>
          </div>

        {history.length === 0 ? (
          <p className="empty-state">Analyzed reports will appear here like a mini database.</p>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setResult(item);
                  setShowHistory(true);
                  window.setTimeout(() => {
                    document.getElementById("ai-report-result")?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
              >
                <span>
                  {item.sector || "General"}
                  {normalizeName(item.submitted_by) === normalizeName(user?.name) ? " | Submitted by you" : ""}
                </span>
                <strong>{item.title}</strong>
                <small>
                  {item.location} | {item.createdAt}
                </small>
              </button>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}

export default App;
