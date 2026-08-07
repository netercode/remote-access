import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Address } from 'viem';
import { api, ApiError } from '../lib/api';
import { ConnectPanel } from '../components/ConnectPanel';
import { EmergencySweepPanel } from '../components/EmergencySweepPanel';

export function Emergency() {
  const { token } = useParams<{ token: string }>();
  const [safetyAddress, setSafetyAddress] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Missing link.');
      setLoading(false);
      return;
    }
    api
      .resolveEmergencyLink(token)
      .then((result) => setSafetyAddress(result.safetyAddress as Address))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'This link is invalid.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="wrap">
      <header>
        <div>
          <div className="eyebrow">⟨ Safety Sweep · Emergency ⟩</div>
          <h1>EMERGENCY SWEEP</h1>
          <p className="sub">Connect your wallet — everything else happens automatically.</p>
        </div>
      </header>

      {loading && <div className="panel">Loading...</div>}

      {error && (
        <div className="panel">
          <h2>Link not valid</h2>
          <p className="muted">{error}</p>
        </div>
      )}

      {safetyAddress && (
        <>
          <div className="panel">
            <div className="destination-banner" style={{ marginBottom: 0 }}>
              <div className="destination-label">This link sends funds only to</div>
              <div className="destination-address">{safetyAddress}</div>
            </div>
          </div>
          <ConnectPanel />
          <EmergencySweepPanel safetyAddress={safetyAddress} />
        </>
      )}

      <footer>
        This link can only ever send funds to the safety wallet address shown above, set in
        advance by the account owner. It cannot change that destination — changing it requires
        logging into the account directly.
      </footer>
    </div>
  );
}
