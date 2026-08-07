import { Link } from 'react-router-dom';

export function Landing() {
  return (
    <div className="wrap">
      <div className="login-wrap">
        <div className="eyebrow">⟨ Safety Sweep ⟩</div>
        <h1>SAFETY SWEEP</h1>
        <p className="sub" style={{ margin: '0 auto 24px' }}>
          Set your safety wallet once. Get a personal emergency link. When it matters, open it in
          your wallet's app — connect, scan, and sweep everything in one click.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
          <Link to="/signup" className="btn btn-primary btn-block">
            Create account
          </Link>
          <Link to="/login" className="btn btn-ghost btn-block">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
