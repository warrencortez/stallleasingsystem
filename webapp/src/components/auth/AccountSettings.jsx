import { useState } from 'react';
import { authAPI } from '../../api/endpoints';

export default function AccountSettings() {
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null);
    const submit = async event => {
        event.preventDefault();
        if (saving) return;
        setNotice(null);
        if (form.newPassword !== form.confirmation) {
            setNotice({ error: true, text: 'The new passwords do not match.' });
            return;
        }
        if (form.currentPassword === form.newPassword) {
            setNotice({ error: true, text: 'Choose a different new password.' });
            return;
        }
        setSaving(true);
        try {
            await authAPI.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
            setForm({ currentPassword: '', newPassword: '', confirmation: '' });
            setNotice({ error: false, text: 'Password changed successfully. Use your new password the next time you sign in.' });
        } catch (error) {
            setNotice({ error: true, text: error.response?.data?.message || 'Unable to change your password. Please try again.' });
        } finally {
            setSaving(false);
        }
    };
    return (
        <div className="container-fluid py-4">
            <h1 className="h3 mb-4">Account Settings</h1>
            <div className="card p-4 shadow-sm" style={{ maxWidth: 560 }}>
                <h2 className="h5">Change Password</h2>
                <p className="text-muted">Enter your current password and choose a new one.</p>
                {notice && <div className={`alert alert-${notice.error ? 'danger' : 'success'}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
                <form onSubmit={submit}>
                    {[
                        ['currentPassword', 'Current password', 'current-password'],
                        ['newPassword', 'New password', 'new-password'],
                        ['confirmation', 'Confirm new password', 'new-password']
                    ].map(([name, label, autocomplete]) => (
                        <div className="mb-3" key={name}>
                            <label htmlFor={name} className="form-label">{label}</label>
                            <input id={name} name={name} type="password" className="form-control"
                                autoComplete={autocomplete} required minLength={name === 'currentPassword' ? undefined : 12}
                                value={form[name]} disabled={saving}
                                onChange={event => setForm({ ...form, [name]: event.target.value })} />
                        </div>
                    ))}
                    <p className="small text-muted">Use at least 12 characters for your new password.</p>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Change Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
