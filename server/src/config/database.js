const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

dotenv.config();

let isLiveDBConnected = false;
const { AsyncLocalStorage } = require('node:async_hooks');
const transactionContext = new AsyncLocalStorage();
const demoMode = process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
let transactionQueue = Promise.resolve();

// Create pg connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
});

// ==========================================================
// EXPLICIT LOCAL DEMO STORE (NEVER USED AS LIVE DATABASE FAILOVER)
// ==========================================================
const adminHashedPassword = bcrypt.hashSync('admin123', 10);
const createId = () => crypto.randomUUID();

const memoryDB = {
    users: [
        {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'System Administrator',
            email: 'rentastall@gmail.com',
            password: adminHashedPassword,
            role: 'admin',
            phone: '+63 900 000 0000',
            address: 'Commercial Center Administration Office',
            is_active: true,
            created_at: new Date().toISOString()
        }
    ],
    stalls: [],
    tenants: [],
    payments: [],
    applications: [],
    maintenance_requests: [],
    announcements: [],
    notifications: []
};

// Resilient Query Dispatcher
const dbQuery = async (text, params = []) => {
    const client = transactionContext.getStore();
    if (client) return client.query(text, params);
    if (isLiveDBConnected) return pool.query(text, params);
    if (!demoMode) throw new Error('Database unavailable. Configure PostgreSQL or explicitly enable DEMO_MODE for local testing.');

    // ==========================================================
    // IN-MEMORY EMULATOR FOR LOCAL DEMO MODE ONLY
    // ==========================================================
    const sql = text.trim().toLowerCase();

    // ----------------------------------------------------------
    // 1. DELETE OPERATIONS
    // ----------------------------------------------------------
    if (sql.startsWith('delete from stalls')) {
        const id = params[0];
        const idx = memoryDB.stalls.findIndex(s => s.id === id);
        if (idx !== -1) {
            const removed = memoryDB.stalls.splice(idx, 1)[0];
            // Unlink any tenants associated with this stall
            memoryDB.tenants.forEach(t => {
                if (t.stall_id === id) {
                    t.stall_id = null;
                    t.stall_number = null;
                }
            });
            return { rows: [removed], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('delete from tenants')) {
        const id = params[0];
        const idx = memoryDB.tenants.findIndex(t => t.id === id);
        if (idx !== -1) {
            const removed = memoryDB.tenants.splice(idx, 1)[0];
            if (removed.stall_id) {
                const stall = memoryDB.stalls.find(s => s.id === removed.stall_id);
                if (stall) {
                    stall.status = 'available';
                    stall.tenant_name = null;
                }
            }
            return { rows: [removed], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('delete from applications')) {
        const id = params[0];
        const idx = memoryDB.applications.findIndex(a => a.id === id);
        if (idx !== -1) {
            const removed = memoryDB.applications.splice(idx, 1)[0];
            return { rows: [removed], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('delete from announcements')) {
        const id = params[0];
        const idx = memoryDB.announcements.findIndex(a => a.id === id);
        if (idx !== -1) {
            const removed = memoryDB.announcements.splice(idx, 1)[0];
            return { rows: [removed], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('delete from users')) {
        const id = params[0];
        const idx = memoryDB.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            const removed = memoryDB.users.splice(idx, 1)[0];
            return { rows: [removed], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('delete from payments')) {
        const id = params[0];
        const idx = memoryDB.payments.findIndex(p => p.id === id);
        if (idx !== -1) {
            const removed = memoryDB.payments.splice(idx, 1)[0];
            return { rows: [removed], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('delete from maintenance_requests')) {
        const id = params[0];
        const idx = memoryDB.maintenance_requests.findIndex(m => m.id === id);
        if (idx !== -1) {
            const removed = memoryDB.maintenance_requests.splice(idx, 1)[0];
            return { rows: [removed], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    // ----------------------------------------------------------
    // 2. STALLS DUES OVERVIEW QUERY (Payment.getStallsBillingOverview)
    // ----------------------------------------------------------
    if (sql.includes('due_p.status') || sql.includes('agg.total_unpaid_amount') || sql.includes('stalls-overview')) {
        const overview = memoryDB.stalls.map(s => {
            const tenant = memoryDB.tenants.find(t => (t.stall_id === s.id && t.status === 'active') || t.name === s.tenant_name) || null;
            const stallPayments = memoryDB.payments.filter(p => p.stall_id === s.id || (tenant && p.tenant_id === tenant.id));

            // Find primary active due invoice (overdue > unpaid > pending_verification)
            const unpaidList = stallPayments.filter(p => ['overdue', 'unpaid', 'pending_verification'].includes(p.status));
            unpaidList.sort((a, b) => {
                const rank = { overdue: 1, unpaid: 2, pending_verification: 3 };
                return (rank[a.status] || 4) - (rank[b.status] || 4);
            });
            const due_p = unpaidList[0] || null;

            // Compute aggregates
            const total_unpaid_amount = unpaidList.reduce((acc, p) => acc + (Number(p.amount) + Number(p.late_fee || 0)), 0);
            const unpaid_invoices_count = unpaidList.length;

            const paidList = stallPayments.filter(p => p.status === 'paid');
            const total_paid_amount = paidList.reduce((acc, p) => acc + Number(p.amount), 0);
            const paid_invoices_count = paidList.length;

            const latest_paid = paidList.length > 0 ? paidList[0] : null;

            return {
                id: s.id,
                stall_number: s.stall_number,
                location: s.location,
                size: s.size,
                monthly_rent: s.monthly_rent,
                status: s.status,
                description: s.description,
                tenant_id: tenant ? tenant.id : null,
                tenant_name: tenant ? tenant.name : (s.tenant_name || null),
                tenant_email: tenant ? tenant.email : null,
                tenant_phone: tenant ? tenant.phone : null,
                business_name: tenant ? tenant.business_name : null,
                business_type: tenant ? tenant.business_type : null,
                active_due_id: due_p ? due_p.id : null,
                active_due_amount: due_p ? due_p.amount : null,
                active_due_date: due_p ? due_p.due_date : null,
                active_due_status: due_p ? due_p.status : null,
                active_late_fee: due_p ? due_p.late_fee : 0,
                active_due_description: due_p ? due_p.description : null,
                total_unpaid_amount,
                unpaid_invoices_count,
                total_paid_amount,
                paid_invoices_count,
                latest_payment_date: latest_paid ? (latest_paid.payment_date || latest_paid.created_at) : null,
                latest_payment_method: latest_paid ? latest_paid.payment_method : null,
                latest_reference_number: latest_paid ? latest_paid.reference_number : null
            };
        });

        // Sort by Due status priority (Overdue > Unpaid > Pending > Settled), then Stall Number ASC
        overview.sort((a, b) => {
            const getRank = (status) => {
                if (status === 'overdue') return 1;
                if (status === 'unpaid') return 2;
                if (status === 'pending_verification') return 3;
                return 4;
            };
            const rankA = getRank(a.active_due_status);
            const rankB = getRank(b.active_due_status);
            if (rankA !== rankB) return rankA - rankB;
            return a.stall_number.localeCompare(b.stall_number);
        });

        return { rows: overview, rowCount: overview.length };
    }

    // ----------------------------------------------------------
    // 3. USERS QUERIES & MUTATIONS
    // ----------------------------------------------------------
    if (sql.includes('from users where lower(email) =') || sql.includes('from users where email =') || sql.includes('or phone =')) {
        const identifier = (params[0] || '').trim().toLowerCase();
        const cleanDigits = identifier.replace(/[^0-9]/g, '');
        const user = memoryDB.users.find(u => {
            const uEmail = (u.email || '').toLowerCase();
            const uPhone = (u.phone || '').trim();
            const uDigits = uPhone.replace(/[^0-9]/g, '');
            return (
                uEmail === identifier ||
                (uPhone && uPhone.toLowerCase() === identifier) ||
                (cleanDigits && cleanDigits.length >= 7 && uDigits && (uDigits === cleanDigits || uDigits.endsWith(cleanDigits) || cleanDigits.endsWith(uDigits)))
            );
        });
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    if (sql.includes('from users where id =')) {
        const user = memoryDB.users.find(u => u.id === params[0]);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    if (sql.includes('from users')) {
        return { rows: memoryDB.users, rowCount: memoryDB.users.length };
    }

    if (sql.startsWith('insert into users')) {
        const newUser = {
            id: createId(),
            name: params[0],
            email: params[1],
            password: params[2],
            role: params[3] || 'tenant',
            phone: params[4] || '',
            address: params[5] || '',
            is_active: true,
            created_at: new Date().toISOString()
        };
        memoryDB.users.unshift(newUser);
        return { rows: [{ id: newUser.id }], rowCount: 1 };
    }

    if (sql.startsWith('update users')) {
        const id = params[params.length - 1];
        const u = memoryDB.users.find(x => x.id === id);
        if (u) {
            for (const match of sql.matchAll(/(\w+) = \$(\d+)/g)) {
                if (match[1] !== 'id') u[match[1]] = params[Number(match[2]) - 1];
            }
            return { rows: [u], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    // ----------------------------------------------------------
    // 4. STALLS QUERIES & MUTATIONS
    // ----------------------------------------------------------
    if (sql.includes('from stalls')) {
        if (sql.includes('where s.id =') || sql.includes('where id =')) {
            const stall = memoryDB.stalls.find(s => s.id === params[0]);
            return { rows: stall ? [stall] : [], rowCount: stall ? 1 : 0 };
        }
        if (sql.includes('count(*) as total')) {
            const total = memoryDB.stalls.length;
            const available = memoryDB.stalls.filter(s => s.status === 'available').length;
            const occupied = memoryDB.stalls.filter(s => s.status === 'occupied').length;
            const maintenance = memoryDB.stalls.filter(s => s.status === 'maintenance').length;
            const reserved = memoryDB.stalls.filter(s => s.status === 'reserved').length;
            return { rows: [{ total, available, occupied, maintenance, reserved }], rowCount: 1 };
        }
        return { rows: memoryDB.stalls, rowCount: memoryDB.stalls.length };
    }

    if (sql.startsWith('insert into stalls')) {
        const newStall = {
            id: createId(),
            stall_number: params[0],
            location: params[1],
            size: params[2],
            monthly_rent: parseFloat(params[3]),
            status: params[4] || 'available',
            description: params[5] || '',
            created_at: new Date().toISOString()
        };
        memoryDB.stalls.unshift(newStall);
        return { rows: [{ id: newStall.id }], rowCount: 1 };
    }

    if (sql.startsWith('update stalls')) {
        const id = params[params.length - 1];
        const s = memoryDB.stalls.find(x => x.id === id);
        if (s) {
            if (sql.includes('status = $1')) {
                s.status = params[0] || s.status;
            } else {
                s.stall_number = params[0] || s.stall_number;
                s.location = params[1] || s.location;
                s.size = params[2] || s.size;
                s.monthly_rent = parseFloat(params[3]) || s.monthly_rent;
                s.status = params[4] || s.status;
                s.description = params[5] !== undefined ? params[5] : s.description;
            }
            return { rows: [s], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    // ----------------------------------------------------------
    // 5. TENANTS QUERIES & MUTATIONS
    // ----------------------------------------------------------
    if (sql.includes('from tenants')) {
        if (sql.includes('t.id as tenant_id')) {
            const rows = memoryDB.tenants.map(t => {
                const stall = memoryDB.stalls.find(s => s.id === t.stall_id);
                return { ...t, tenant_id: t.id, stall_number: stall?.stall_number, monthly_rent: stall?.monthly_rent };
            });
            return { rows, rowCount: rows.length };
        }
        if (sql.includes('where t.id =') || sql.includes('where id =')) {
            const t = memoryDB.tenants.find(x => x.id === params[0]);
            return { rows: t ? [t] : [], rowCount: t ? 1 : 0 };
        }
        if (sql.includes('where t.user_id =') || sql.includes('where user_id =')) {
            const t = memoryDB.tenants.find(x => x.user_id === params[0]);
            return { rows: t ? [t] : [], rowCount: t ? 1 : 0 };
        }
        if (sql.includes('where email =')) {
            const t = memoryDB.tenants.find(x => x.email?.toLowerCase() === params[0]?.toLowerCase());
            return { rows: t ? [t] : [], rowCount: t ? 1 : 0 };
        }
        if (sql.includes('count(*) as total')) {
            const total = memoryDB.tenants.length;
            const active = memoryDB.tenants.filter(t => t.status === 'active').length;
            const inactive = memoryDB.tenants.filter(t => t.status === 'inactive').length;
            const pending = memoryDB.tenants.filter(t => t.status === 'pending').length;
            return { rows: [{ total, active, inactive, pending }], rowCount: 1 };
        }
        const rows = memoryDB.tenants.map(t => { const stall = memoryDB.stalls.find(s => s.id === t.stall_id); return { ...t, stall_number: stall?.stall_number, monthly_rent: stall?.monthly_rent, location: stall?.location }; });
        return { rows, rowCount: rows.length };
    }

    if (sql.startsWith('insert into tenants')) {
        const newT = {
            id: createId(),
            user_id: params[0],
            stall_id: params[1],
            name: params[2],
            email: params[3],
            phone: params[4],
            address: params[5],
            business_name: params[6],
            business_type: params[7],
            contract_start: params[8],
            contract_end: params[9],
            status: params[10] || 'pending',
            created_at: new Date().toISOString()
        };
        memoryDB.tenants.unshift(newT);
        return { rows: [{ id: newT.id }], rowCount: 1 };
    }

    if (sql.startsWith('update tenants')) {
        const id = params[params.length - 1];
        const t = memoryDB.tenants.find(x => x.id === id);
        if (t) {
            if (sql.includes('status = $1')) {
                t.status = params[0] || t.status;
            }
            return { rows: [t], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    // ----------------------------------------------------------
    // 6. PAYMENTS QUERIES & MUTATIONS
    // ----------------------------------------------------------
    if (sql.includes('from payments')) {
        if (sql.includes('where p.id =') || sql.includes('where id =')) {
            const p = memoryDB.payments.find(x => x.id === params[0]);
            return { rows: p ? [p] : [], rowCount: p ? 1 : 0 };
        }
        if (sql.includes('where p.tenant_id =') || sql.includes('where tenant_id =')) {
            let tPayments = memoryDB.payments.filter(x => x.tenant_id === params[0]);
            if (sql.includes('extract(month')) {
                tPayments = tPayments.filter(p => {
                    const date = new Date(p.due_date);
                    return date.getUTCMonth() + 1 === Number(params[1]) && date.getUTCFullYear() === Number(params[2]) && p.stall_id === params[3];
                });
            }
            return { rows: tPayments, rowCount: tPayments.length };
        }
        if (sql.includes('where p.stall_id =') || sql.includes('where stall_id =')) {
            const sPayments = memoryDB.payments.filter(x => x.stall_id === params[0]);
            return { rows: sPayments, rowCount: sPayments.length };
        }
        if (sql.includes('count(*) as total') || sql.includes('sum(case when status')) {
            const total_collected = memoryDB.payments.filter(p => p.status === 'paid').reduce((a, b) => a + Number(b.amount), 0);
            const total_outstanding = memoryDB.payments.filter(p => p.status !== 'paid').reduce((a, b) => a + Number(b.amount), 0);
            return {
                rows: [{
                    total: memoryDB.payments.length,
                    paid: memoryDB.payments.filter(p => p.status === 'paid').length,
                    unpaid: memoryDB.payments.filter(p => p.status === 'unpaid').length,
                    overdue: memoryDB.payments.filter(p => p.status === 'overdue').length,
                    pending_verification: memoryDB.payments.filter(p => p.status === 'pending_verification').length,
                    total_collected,
                    total_outstanding
                }],
                rowCount: 1
            };
        }

        // Enrich payments with latest tenant and stall numbers
        const enrichedPayments = memoryDB.payments.map(p => {
            const t = memoryDB.tenants.find(x => x.id === p.tenant_id);
            const s = memoryDB.stalls.find(x => x.id === p.stall_id);
            return {
                ...p,
                tenant_name: p.tenant_name || (t ? t.name : 'Commercial Tenant'),
                tenant_email: p.tenant_email || (t ? t.email : null),
                tenant_phone: p.tenant_phone || (t ? t.phone : null),
                business_name: t ? t.business_name : null,
                stall_number: p.stall_number || (s ? s.stall_number : 'STALL'),
                stall_location: s ? s.location : ''
            };
        });

        const filteredPayments = enrichedPayments.filter(p => {
            for (const match of sql.matchAll(/(?:p\.|t\.)(user_id|tenant_id|stall_id|status) = \$(\d+)/g)) {
                const value = match[1] === 'user_id' ? memoryDB.tenants.find(t => t.id === p.tenant_id)?.user_id : p[match[1]];
                if (value !== params[Number(match[2]) - 1]) return false;
            }
            for (const match of sql.matchAll(/extract\((month|year) from p.due_date\) = \$(\d+)/g)) {
                const date = new Date(p.due_date);
                if ((match[1] === 'month' ? date.getUTCMonth() + 1 : date.getUTCFullYear()) !== Number(params[Number(match[2]) - 1])) return false;
            }
            return true;
        });
        return { rows: filteredPayments, rowCount: filteredPayments.length };
    }

    if (sql.startsWith('update payments')) {
        const id = params[params.length - 1];
        const p = memoryDB.payments.find(x => x.id === id);
        if (p) {
            if (sql.includes("status <> 'paid'") && p.status === 'paid') return { rows: [], rowCount: 0 };
            if (sql.includes('paymongo_checkout_id = $1')) {
                p.paymongo_checkout_id = params[0]; p.paymongo_checkout_url = params[1]; p.reference_number = params[2] || p.reference_number;
            }
            // Check for recordPayment / mark as paid
            if (sql.includes("status = 'paid'") || sql.includes('status = $1') || sql.includes('payment_date = current_date')) {
                p.status = params[0] || 'paid';
                p.payment_date = p.status === 'paid' ? new Date().toISOString().split('T')[0] : null;
                p.payment_method = params[1] || p.payment_method || 'paymongo_online';
                p.reference_number = params[2] || p.reference_number || `REF-${Date.now()}`;
                if (params[3]) p.proof_image = params[3];
                if (params[4]) p.paymongo_checkout_id = params[4];
            }
            if (sql.includes('late_fee =')) {
                p.status = 'overdue';
                p.late_fee = parseFloat(p.amount) * 0.05;
            }
            return { rows: [p], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('insert into payments')) {
        const newPayment = {
            id: createId(),
            tenant_id: params[0],
            stall_id: params[1],
            amount: parseFloat(params[2]),
            due_date: params[3],
            status: sql.includes("'unpaid'") ? 'unpaid' : (params[5] || 'unpaid'),
            payment_date: sql.includes("'unpaid'") ? null : params[4],
            description: sql.includes("'unpaid'") ? params[4] : params[11],
            created_at: new Date().toISOString()
        };
        memoryDB.payments.unshift(newPayment);
        return { rows: [{ id: newPayment.id }], rowCount: 1 };
    }

    // ----------------------------------------------------------
    // 7. APPLICATIONS QUERIES & MUTATIONS
    // ----------------------------------------------------------
    if (sql.includes('from applications')) {
        if (sql.includes('where a.id =') || sql.includes('where id =')) {
            const app = memoryDB.applications.find(a => a.id === params[0]);
            return { rows: app ? [app] : [], rowCount: app ? 1 : 0 };
        }
        return { rows: memoryDB.applications, rowCount: memoryDB.applications.length };
    }

    if (sql.startsWith('insert into applications')) {
        const fields = ['user_id', 'stall_id', 'full_name', 'email', 'phone', 'business_name', 'business_type', 'notes', 'valid_id_url', 'business_permit_url'];
        const app = { id: createId(), status: 'pending', created_at: new Date().toISOString() };
        fields.forEach((field, i) => app[field] = params[i]);
        memoryDB.applications.push(app);
        return { rows: [{ id: app.id }], rowCount: 1 };
    }
    if (sql.startsWith('update applications')) {
        const app = memoryDB.applications.find(a => a.id === params[params.length - 1]);
        if (!app) return { rows: [], rowCount: 0 };
        for (const match of sql.matchAll(/(\w+) = \$(\d+)/g)) {
            if (match[1] !== 'id') app[match[1]] = params[Number(match[2]) - 1];
        }
        app.reviewed_at = new Date().toISOString();
        return { rows: [app], rowCount: 1 };
    }

    // ----------------------------------------------------------
    // 8. MAINTENANCE REQUESTS
    // ----------------------------------------------------------
    if (sql.includes('from maintenance_requests')) {
        if (sql.includes('where m.id =') || sql.includes('where id =')) {
            const m = memoryDB.maintenance_requests.find(x => x.id === params[0]);
            return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
        }
        return { rows: memoryDB.maintenance_requests, rowCount: memoryDB.maintenance_requests.length };
    }

    if (sql.startsWith('insert into maintenance_requests')) {
        const newM = {
            id: createId(),
            tenant_id: params[0],
            stall_id: params[1],
            title: params[2],
            description: params[3],
            category: params[4] || 'general',
            priority: params[5] || 'medium',
            status: 'pending',
            created_at: new Date().toISOString()
        };
        memoryDB.maintenance_requests.unshift(newM);
        return { rows: [{ id: newM.id }], rowCount: 1 };
    }

    // ----------------------------------------------------------
    // 9. ANNOUNCEMENTS & NOTIFICATIONS
    // ----------------------------------------------------------
    if (sql.includes('from announcements')) {
        return { rows: memoryDB.announcements, rowCount: memoryDB.announcements.length };
    }

    if (sql.startsWith('insert into announcements')) {
        const newA = {
            id: createId(),
            author_id: params[0],
            title: params[1],
            content: params[2],
            category: params[3] || 'general',
            is_pinned: params[4] || false,
            target_audience: params[5] || 'all',
            created_at: new Date().toISOString()
        };
        memoryDB.announcements.unshift(newA);
        return { rows: [{ id: newA.id }], rowCount: 1 };
    }

    if (sql.includes('from notifications')) {
        const userNotifs = memoryDB.notifications.filter(n => n.user_id === params[0]);
        if (sql.includes('count(*) as unread_count')) {
            const unread = userNotifs.filter(n => !n.is_read).length;
            return { rows: [{ unread_count: unread }], rowCount: 1 };
        }
        return { rows: userNotifs, rowCount: userNotifs.length };
    }

    if (sql.startsWith('update notifications')) {
        if (sql.includes('where id = $1 and user_id = $2')) {
            const notif = memoryDB.notifications.find(n => n.id === params[0] && n.user_id === params[1]);
            if (notif) notif.is_read = true;
            return { rows: [notif || {}], rowCount: notif ? 1 : 0 };
        }
        if (sql.includes('where user_id = $1')) {
            let count = 0;
            memoryDB.notifications.filter(n => n.user_id === params[0]).forEach(n => {
                n.is_read = true;
                count++;
            });
            return { rows: [], rowCount: count };
        }
    }

    if (sql.startsWith('insert into notifications')) {
        const newN = {
            id: createId(),
            user_id: params[0],
            title: params[1],
            message: params[2],
            type: params[3] || 'general',
            link: params[4] || null,
            is_read: false,
            created_at: new Date().toISOString()
        };
        memoryDB.notifications.unshift(newN);
        return { rows: [{ id: newN.id }], rowCount: 1 };
    }

    // Generic fallback return
    return { rows: [], rowCount: 0 };
};

// Safe Pool Wrapper
const safePool = {
    query: dbQuery,
    connect: async () => pool.connect(),
    withTransaction: async work => {
        if (isLiveDBConnected) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const result = await transactionContext.run(client, () => work(client));
                await client.query('COMMIT');
                return result;
            } catch (error) { await client.query('ROLLBACK'); throw error; }
            finally { client.release(); }
        }
        if (!demoMode) throw new Error('Database unavailable.');
        const run = transactionQueue.then(async () => {
            const snapshot = structuredClone(memoryDB);
            try { return await work({ query: dbQuery }); }
            catch (error) { Object.assign(memoryDB, snapshot); throw error; }
        });
        transactionQueue = run.catch(() => {});
        return run;
    }
};

// Test Connection Function
const testConnection = async () => {
    try {
        if (demoMode) { console.warn('Explicit DEMO_MODE: records are temporary and are lost on restart.'); return true; }
        const client = await pool.connect();
        console.log('✅ Connected to Supabase PostgreSQL database successfully!');
        isLiveDBConnected = true;
        client.release();
        return true;
    } catch (error) {
        console.warn('⚠️ Supabase direct connection unavailable (Error:', error.message + ')');
        console.log('💡 To point to live Supabase: Ensure your Supabase project is active & check DB_HOST in server/.env\n');
        isLiveDBConnected = false;
        return false;
    }
};

module.exports = { pool: safePool, testConnection };
