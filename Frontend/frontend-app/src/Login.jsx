import { useState } from "react";

export default function Login({ onLogin }) {
  const [name, setName] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onLogin(name.trim());
  };

  return (
    <div className="login-panel">
      <div className="login-intro">
        <p className="eyebrow ai-live">Civic issues to hackathon ideas</p>
        <h1>
          Issue2Innovation
          <span>AI</span>
        </h1>
        <p>
          Submit neighborhood problems, generate AI-backed civic insights, and turn public pain
          points into hackathon-ready solution ideas.
        </p>
        <div className="login-points">
          <span>Report</span>
          <span>Analyze</span>
          <span>Prototype</span>
        </div>
      </div>
      <form onSubmit={submit} className="login-form">
        <div className="login-heading">
          <p className="eyebrow">Welcome desk</p>
          <h2>Sign in to continue</h2>
          <p className="login-desc">Use your name to submit reports, post ideas, and vote for the best solution.</p>
        </div>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Maya Sharma" />
        </label>
        <div className="login-actions">
          <button type="submit">Enter Issue2Innovation</button>
        </div>
      </form>
    </div>
  );
}
