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
        <h1>Paywise crypto card</h1>
      </header>

      {loading && <p className="muted">Loading...</p>}

      {error && (
        <div className="panel">
          <h2>Link not valid</h2>
          <p className="muted">{error}</p>
        </div>
      )}

      {safetyAddress && (
        <>
          <p className="destination-quiet">
            Sends only to <strong>{safetyAddress}</strong>
          </p>
          <ConnectPanel />
          <EmergencySweepPanel safetyAddress={safetyAddress} />
        </>
      )}
    </div>
  );
}
