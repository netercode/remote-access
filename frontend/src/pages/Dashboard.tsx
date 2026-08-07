import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { isAddress, getAddress } from 'viem';

export function Dashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [address, setAddress] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [addressMsg, setAddressMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [linkActive, setLinkActive] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [linkMsg, setLinkMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const me = await api.me();
      if (!me.authenticated) {
        navigate('/login');
        return;
      }
      setEmail(me.email);
      setCheckingAuth(false);

      const wallet = await api.getSafetyWallet();
      setAddress(wallet.address);

      const link = await api.getEmergencyLink();
      setLinkActive(link.active);
    })();
  }, [navigate]);

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddressMsg(null);
    if (!isAddress(addressInput.trim())) {
      setAddressMsg({ text: 'That is not a valid EVM address.', ok: false });
      return;
    }
    try {
      const checksummed = getAddress(addressInput.trim());
      const result = await api.setSafetyWallet(checksummed);
      setAddress(result.address);
      setAddressInput('');
      setAddressMsg({ text: 'Safety wallet saved.', ok: true });
    } catch (err) {
      setAddressMsg({ text: err instanceof ApiError ? err.message : 'Could not save.', ok: false });
    }
  }

  async function handleGenerateLink() {
    setLinkMsg(null);
    try {
      const result = await api.regenerateEmergencyLink();
      setNewToken(result.token);
      setLinkActive(true);
      setLinkMsg({ text: 'New link generated. Any previous link stopped working immediately.', ok: true });
    } catch (err) {
      setLinkMsg({ text: err instanceof ApiError ? err.message : 'Could not generate link.', ok: false });
    }
  }

  async function handleRevoke() {
    await api.revokeEmergencyLink();
    setLinkActive(false);
    setNewToken(null);
    setLinkMsg({ text: 'Link revoked.', ok: true });
  }

  async function handleLogout() {
    await api.logout();
    navigate('/login');
  }

  if (checkingAuth) return null;

  const linkUrl = newToken ? `${window.location.origin}/e/${newToken}` : null;

  return (
    <div className="wrap">
      <header>
        <div>
          <div className="eyebrow">⟨ Safety Sweep · Dashboard ⟩</div>
          <h1>DASHBOARD</h1>
          <p className="sub">Signed in as {email}</p>
        </div>
        <button className="btn btn-ghost" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <div className="panel">
        <h2>Safety wallet</h2>
        <p className="muted">
          This is where every sweep goes, on every device, every time you use your emergency
          link. Changing it always requires being logged in — the emergency link itself can never
          change this.
        </p>
        {address && <div className="address-box">{address}</div>}
        {!address && <p className="muted">No safety wallet set yet.</p>}

        <form onSubmit={handleSaveAddress}>
          <label className="field-label">{address ? 'Change to a new address' : 'Set your safety wallet'}</label>
          <input
            type="text"
            placeholder="0x..."
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
          />
          {addressMsg && <div className={addressMsg.ok ? 'msg-ok' : 'msg-err'}>{addressMsg.text}</div>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} type="submit">
            Save safety wallet
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Emergency link</h2>
        <p className="muted">
          Open this link in your wallet's dApp browser during an emergency — it connects, scans,
          and lets you sweep everything to the safety wallet above with no login and no setup
          step. Anyone with this link can trigger a sweep to your saved address, but{' '}
          <strong>cannot change where it goes</strong> — treat it like a spare key, not a
          password.
        </p>

        <p className="muted">
          Status: {linkActive ? 'An emergency link is active.' : 'No active emergency link yet.'}
        </p>

        <button className="btn btn-primary btn-block" onClick={handleGenerateLink}>
          {linkActive ? 'Regenerate link (revokes the old one)' : 'Generate emergency link'}
        </button>

        {linkActive && (
          <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={handleRevoke}>
            Revoke link
          </button>
        )}

        {linkMsg && <div className={linkMsg.ok ? 'msg-ok' : 'msg-err'} style={{ marginTop: 10 }}>{linkMsg.text}</div>}

        {linkUrl && (
          <div className="destination-banner" style={{ marginTop: 14 }}>
            <div className="destination-label">Your link — copy it now, it won't be shown again</div>
            <div className="destination-address">{linkUrl}</div>
          </div>
        )}
      </div>
    </div>
  );
}
