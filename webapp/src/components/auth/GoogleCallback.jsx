import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { finishGoogleLogin, supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';

export default function GoogleCallback() {
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [accessToken, setAccessToken] = useState(null);
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('Completing Google sign-in…');
    const [busy, setBusy] = useState(true);
    const started = useRef(false);
    async function complete(token, existingPassword) {
        const result = await loginWithGoogle(token, existingPassword);
        if (result.success) {
            await supabase().auth.signOut({ scope: 'local' });
            setAccessToken(null);
            navigate('/dashboard', { replace: true });
        } else if (result.code === 'GOOGLE_LINK_REQUIRED') {
            setAccessToken(token);
            setMessage('Enter your existing administrator password to connect Google to your account.');
        } else setMessage(result.message);
        setBusy(false);
    }
    useEffect(() => {
        if (started.current) return;
        started.current = true;
        finishGoogleLogin().then(token => complete(token)).catch(error => { setMessage(error.message); setBusy(false); });
    }, []);
    return <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
        <div className="card p-4 shadow-sm" style={{ maxWidth: 440, width: '100%' }}>
            <h1 className="h4">Google sign-in</h1>
            <p role="status">{message}</p>
            {accessToken && <form onSubmit={async event => { event.preventDefault(); setBusy(true); await complete(accessToken, password); }}>
                <label className="form-label" htmlFor="link-password">Existing account password</label>
                <input id="link-password" className="form-control mb-3" type="password" autoComplete="current-password"
                    required value={password} onChange={event => setPassword(event.target.value)} />
                <button className="btn btn-primary w-100 mb-3" disabled={busy}>{busy ? 'Connecting…' : 'Connect Google and Sign In'}</button>
            </form>}
            <Link to="/login">Back to login</Link>
        </div>
    </main>;
}
