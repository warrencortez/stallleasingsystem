const supabase = require('../config/supabase');
const PREFIX = 'storage://';
function bucket() { return supabase.storage().storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'stall-uploads'); }
async function save(file, folder, userId) {
    const path = `${folder}/${userId}/${require('node:crypto').randomUUID()}${require('node:path').extname(file.originalname).toLowerCase()}`;
    const { error } = await bucket().upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new Error('Photo upload failed. Please try again.');
    return PREFIX + path;
}
async function url(value) {
    if (!value?.startsWith(PREFIX)) return value;
    const { data, error } = await bucket().createSignedUrl(value.slice(PREFIX.length), 3600);
    if (error) throw new Error('Attachment is temporarily unavailable.');
    return data.signedUrl;
}
async function signRecords(records, field) {
    if (Array.isArray(records)) return Promise.all(records.map(record => signRecords(record, field)));
    if (!records) return records;
    return { ...records, [field]: await url(records[field]) };
}
module.exports = { save, url, signRecords };
