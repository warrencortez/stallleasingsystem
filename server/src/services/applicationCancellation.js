const { pool } = require('../config/database');
const Application = require('../models/Application');
const fail = (status,message) => { throw Object.assign(new Error(message),{status}); };
async function cancel(id,userId) {
    return pool.withTransaction(async client => {
        const initial=await Application.findById(id);
        if (!initial) fail(404,'Application not found.');
        if (initial.user_id!==userId) fail(403,'You can only cancel your own applications.');
        // Match the review/create lock order so cancellation cannot race approval.
        if (initial.stall_id) await client.query('SELECT id FROM stalls WHERE id = $1 FOR UPDATE',[initial.stall_id]);
        await client.query('SELECT id FROM applications WHERE id = $1 FOR UPDATE',[id]);
        const application=await Application.findById(id);
        if (!application) fail(404,'Application not found.');
        if (application.user_id!==userId) fail(403,'You can only cancel your own applications.');
        if (application.status==='cancelled') return application;
        if (application.status!=='pending') fail(409,'Only pending applications can be cancelled. This application has already been reviewed.');
        await Application.update(id,{status:'cancelled'});
        return Application.findById(id);
    });
}
module.exports={cancel};
