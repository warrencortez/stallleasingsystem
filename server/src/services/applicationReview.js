const { pool } = require('../config/database');
const Application = require('../models/Application');
const Stall = require('../models/Stall');
const Tenant = require('../models/Tenant');
const Notification = require('../models/Notification');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

async function review(id, status, notes, reviewerId) {
    return pool.withTransaction(async client => {
        const initial = await Application.findById(id);
        if (!initial) fail(404, 'Application not found.');
        // Lock the stall first so competing approvals always use the same lock order.
        if (initial.stall_id) await client.query('SELECT id FROM stalls WHERE id = $1 FOR UPDATE', [initial.stall_id]);
        await client.query('SELECT id FROM applications WHERE id = $1 FOR UPDATE', [id]);
        const application = await Application.findById(id);
        if (application.status !== 'pending') fail(409, 'Application has already been reviewed.');
        if (status === 'approved') {
            const stall = application.stall_id && await Stall.findById(application.stall_id);
            if (!stall || stall.status !== 'available') fail(409, 'This stall is no longer available.');
            const leases = await Tenant.findAll();
            if (leases.some(t => t.stall_id === stall.id && t.status === 'active')) fail(409, 'This stall already has an active lease.');
            const start = new Date();
            const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
            // Each approved stall has its own lease; do not overwrite an earlier lease by email.
            await Tenant.create({ user_id: application.user_id, stall_id: stall.id,
                name: application.full_name, email: application.email, phone: application.phone,
                business_name: application.business_name, business_type: application.business_type,
                status: 'active', contract_start: start, contract_end: end });
            await Stall.updateStatus(stall.id, 'occupied');
            const competing = (await Application.findAll()).filter(a => a.id !== id && a.stall_id === stall.id && a.status === 'pending');
            for (const other of competing) {
                await Application.updateStatus(other.id, 'rejected', reviewerId);
                await Application.update(other.id, { notes: 'Stall leased to another approved applicant.' });
                if (other.user_id) await Notification.create({ user_id: other.user_id, title: 'Application update',
                    message: 'The stall was leased to another approved applicant.', type: 'application_status', link: '/stalls' });
            }
        }
        await Application.updateStatus(id, status, reviewerId);
        if (notes) await Application.update(id, { notes: `${application.notes || ''}\nReviewer notes: ${notes}` });
        if (application.user_id) await Notification.create({ user_id: application.user_id,
            title: status === 'approved' ? 'Application approved' : 'Application update',
            message: `Your stall application was ${status}.`, type: 'application_status',
            link: `/stalls?stall_id=${application.stall_id || ''}` });
        return Application.findById(id);
    });
}
module.exports = { review };
