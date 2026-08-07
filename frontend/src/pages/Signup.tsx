import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.signup(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Signup failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="login-wrap">
        <div className="eyebrow">⟨ Safety Sweep ⟩</div>
        <h1>CREATE ACCOUNT</h1>
        <form className="panel login-box" onSubmit={handleSubmit}>
          <label className="field-label">Email</label>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="field-label">Password (8+ characters)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="msg-err">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
          <p className="muted" style={{ marginTop: 14 }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
