const SUGGESTIONS = ['Which stalls are available?', 'Check rent due dates', 'Show maintenance reports', 'Show billing summary', 'Check applications', 'Latest announcements'];
const OUTSIDE = "I don't know about that. I can only help with Dela Costa HOA Stall Leasing: stalls, rent due dates, maintenance, applications, announcements, and system reports.";
const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
const date = value => {
    if (!value) return 'not set';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'not set' : parsed.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
};
const clean = value => String(value || '').replace(/[\r\n\t]+/g, ' ').slice(0, 160);

// This assistant deliberately has no general-purpose model, external tools or
// write operations. User input selects an allowlisted read-only system query.
function intentFor(message) {
    const q = message.toLowerCase().trim();
    if (/\b(ignore|override|bypass|pretend|jailbreak|system prompt|password|secret|token|sql|javascript|weather|politics|recipe|bitcoin|sports|poem|joke|capital of|president|translate)\b/.test(q)) return null;
    if (/\b(delete|remove|approve|reject|pay|settle|update|edit|create)\b/.test(q) && !/\b(how|where)\b/.test(q)) return 'readonly';
    if (/\b(how|where)\b/.test(q) && /\b(apply|application|maintenance|payment|pay|bill|tenant|stall|report|system)\b/.test(q)) return 'help';
    if (/\b(maintenance|repair|repairs|leak|electrical|plumbing|sira)\b/.test(q)) return 'maintenance';
    if (/\b(announcement|announcements|advisory|advisories|notice|notices)\b/.test(q)) return 'announcements';
    if (/\b(application|applications|applicant|applicants)\b/.test(q)) return 'applications';
    if (/\b(due|dues|overdue|deadline|deadlines|unpaid|balance|balances|bill|bills|invoice|invoices|owes|owing|utang|bayad)\b/.test(q)) return 'dues';
    if (/\b(report|reports|summary|revenue|collection|collections|billing|payments)\b/.test(q)) return 'summary';
    if (/\b(stall|stalls|vacancy|vacancies|available|availability|bakante)\b/.test(q)) return 'stalls';
    if (/\b(tenant|tenants|lease|leases|contract|contracts)\b/.test(q)) return 'tenants';
    if (/^(hi|hello|hey|help|thanks|thank you)[!.? ]*$/.test(q) || /what can you|what do you|about this system/.test(q)) return 'help';
    return null;
}

function createSystemAssistant(models) {
    return async function answer(message, user) {
        const intent = intentFor(message);
        const response = (reply, extra = {}) => ({ reply, suggestions: SUGGESTIONS, ...extra });
        if (!intent) return response(OUTSIDE, { topic: 'outside' });
        if (intent === 'readonly') return response('I can check system records, but I cannot change records, approve applications, or make payments. Please use the appropriate page in the app.', { topic: intent });
        const admin = ['admin', 'staff'].includes(user.role);
        if (!admin && user.role !== 'tenant') return response('Your account does not have access to the system assistant.');
        if (intent === 'help') return response('I am the Dela Costa HOA Stall Leasing assistant. Ask about available stalls, rent due dates, maintenance reports, applications, announcements, or billing summaries.\n\nTo apply, open Stalls and choose an available stall. Use Billing for invoices and Maintenance to submit a repair request. Tenants are added through approved stall applications.\n\n' + (admin ? 'You can check records across the system. Try “due dates for [tenant name]” or “maintenance reports for [stall number]”.' : 'Your bills, lease, applications and maintenance reports are private to your account.'), { topic: intent });

        const q = message.toLowerCase();
        const scoped = (rows, ids) => admin ? rows : rows.filter(row => ids.has(row.tenant_id));
        // Explicit post-filtering is required because the legacy fallback store
        // does not consistently respect SQL WHERE clauses.
        const tenants = intent === 'stalls' || intent === 'announcements' || intent === 'applications' ? [] : await models.Tenant.findAll();
        const ownTenants = admin ? tenants : tenants.filter(t => t.user_id === user.id);
        const ownIds = new Set(ownTenants.map(t => t.id));
        const selector = q.match(/\b(?:for|of)\s+(.+?)[?.!]*$/)?.[1]?.trim();
        const generic = /^(me|myself|all|all tenants|tenants|the tenants|my stall|my lease|this system|the system)$/;
        const select = rows => !selector || generic.test(selector) ? rows : rows.filter(row => [row.name, row.tenant_name, row.stall_number, row.title, row.business_name, row.full_name].some(v => String(v || '').toLowerCase().includes(selector)));
        const list = (heading, rows, render, link) => response(rows.length ? `${heading} (${rows.length}):\n\n${rows.slice(0, 10).map(render).join('\n\n')}${rows.length > 10 ? `\n\nShowing 10 of ${rows.length}. Open the relevant page for the full list, or ask for a tenant name or stall number.` : ''}` : `No matching ${heading.toLowerCase()} found in the records you can access.`, { topic: intent, link, checkedAt: new Date().toISOString() });
        if (intent === 'stalls') {
            let rows = await models.Stall.findAll();
            const status = /\boccupied\b/.test(q) ? 'occupied' : /\breserved\b/.test(q) ? 'reserved' : /\ball\b/.test(q) ? null : 'available';
            rows = select(rows.filter(s => !status || s.status === status));
            return list(status ? `${status[0].toUpperCase()}${status.slice(1)} stalls` : 'Stalls', rows, s => `• ${clean(s.stall_number)} — ${clean(s.location) || 'Location not set'}\n  Rent: ${money(s.monthly_rent)}; status: ${clean(s.status)}`, '/stalls');
        }
        if (intent === 'announcements') {
            const rows = (await models.Announcement.findAll()).filter(a => admin || ['all', 'tenants'].includes(a.target_audience || 'all'));
            return list('Announcements', rows, a => `• ${clean(a.title)} (${date(a.created_at)})\n  ${clean(a.content)}`, '/announcements');
        }
        if (intent === 'applications') {
            let rows = (await models.Application.findAll(admin ? {} : { user_id: user.id })).filter(a => admin || a.user_id === user.id);
            const status = ['pending', 'approved', 'rejected'].find(s => q.includes(s));
            rows = select(rows.filter(a => !status || a.status === status));
            return list('Applications', rows, a => `• ${clean(a.full_name || a.applicant_name)} — ${clean(a.stall_number) || 'Stall not set'}\n  Status: ${clean(a.status)}; business: ${clean(a.business_name)}`, '/applications');
        }
        if (!admin && !ownIds.size) return response('There is no lease linked to your account yet. You can browse available stalls and check your applications. If your application was approved, please ask the administrator to check your account link.', { topic: intent });
        const names = new Map(ownTenants.map(t => [t.id, t]));
        const enrich = rows => rows.map(row => ({ ...row, tenant_name: names.get(row.tenant_id)?.name || row.tenant_name, stall_number: row.stall_number || names.get(row.tenant_id)?.stall_number }));
        if (intent === 'tenants') return list(admin ? 'Tenant leases' : 'Your lease', select(ownTenants), t => `• ${clean(t.name)} — ${clean(t.stall_number) || 'No stall assigned'}\n  Status: ${clean(t.status)}; contract: ${date(t.contract_start)} to ${date(t.contract_end)}`, '/tenants');
        if (intent === 'maintenance') {
            let rows = select(enrich(scoped(await models.Maintenance.findAll(), ownIds)));
            const status = ['pending', 'in_progress', 'completed', 'cancelled'].find(s => q.includes(s.replace('_', ' ')));
            rows = rows.filter(r => !status || r.status === status);
            return list('Maintenance reports', rows, r => `• ${clean(r.title)} — ${clean(r.stall_number) || 'Stall not set'}\n  Status: ${clean(r.status)}; priority: ${clean(r.priority)}; reported: ${date(r.created_at)}`, '/maintenance');
        }
        const payments = select(enrich(scoped(await models.Payment.findAll(), ownIds)));
        const outstanding = payments.filter(p => ['unpaid', 'overdue', 'partial', 'pending_verification'].includes(p.status));
        if (intent === 'dues') {
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
            const tomorrow = new Date(`${today}T00:00:00Z`);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            const tomorrowDate = tomorrow.toISOString().slice(0, 10);
            const rows = outstanding.filter(p => {
                const dueDate = p.due_date instanceof Date ? p.due_date.toISOString().slice(0, 10) : String(p.due_date || '').slice(0, 10);
                if (/\btoday\b/.test(q) && dueDate !== today) return false;
                if (/\btomorrow\b/.test(q) && dueDate !== tomorrowDate) return false;
                if (/\bthis month\b/.test(q) && dueDate.slice(0, 7) !== today.slice(0, 7)) return false;
                return !q.includes('overdue') || (dueDate && dueDate < today && p.status !== 'pending_verification');
            });
            rows.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
            return list('Rent due dates', rows, p => `• ${clean(p.tenant_name) || 'Tenant'} — ${clean(p.stall_number) || 'Stall not set'}\n  Due: ${date(p.due_date)}; invoice total: ${money(Number(p.amount) + Number(p.late_fee || 0))}; status: ${clean(p.status)}`, '/payments');
        }
        const paid = payments.filter(p => p.status === 'paid');
        const total = rows => rows.reduce((sum, p) => sum + (Number(p.amount) || 0) + (Number(p.late_fee) || 0), 0);
        return response(`${admin ? 'System billing summary' : 'Your billing summary'}${selector && !generic.test(selector) ? ` for ${clean(selector)}` : ''}:\n\n• Invoices: ${payments.length}\n• Marked paid: ${paid.length} — ${money(total(paid))}\n• Outstanding / awaiting verification: ${outstanding.length} — ${money(total(outstanding))}\n\nAmounts reflect the recorded invoice totals and late fees. Payment status comes from system records; this chat does not verify transfers.`, { topic: intent, link: '/payments', checkedAt: new Date().toISOString() });
    };
}
module.exports = { createSystemAssistant, intentFor };
