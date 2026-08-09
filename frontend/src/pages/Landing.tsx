import { Link } from 'react-router-dom';

export function Landing() {
  return (
    <div className="wrap">
      <div className="login-wrap">
        <h1>Safety Sweep</h1>
        <p className="sub" style={{ margin: '0 auto 24px' }}>
          Set your safety wallet once. Get a personal link. When it matters, open it and move
          everything to safety in a click.
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
