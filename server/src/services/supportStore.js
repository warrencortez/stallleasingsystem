const fs = require('node:fs/promises');
const path = require('node:path');

// Atomic, durable storage for this single-server application. Kept outside public
// uploads and version control. Never fall back to an empty store on read errors.
class SupportStore {
    constructor(filename) { this.filename = filename; this.state = null; this.initialization = null; this.queue = Promise.resolve(); }
    async load() {
        if (this.state) return this.state;
        if (!this.initialization) this.initialization = this.readInitial().catch(error => { this.initialization = null; throw error; });
        return this.initialization;
    }
    async readInitial() {
        try {
            const parsed = JSON.parse(await fs.readFile(this.filename, 'utf8'));
            if (parsed.version !== 1 || !parsed.threads || Array.isArray(parsed.threads)) throw new Error('Invalid support conversation store');
            this.state = parsed;
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            this.state = { version: 1, threads: {} };
        }
        return this.state;
    }
    async snapshot() { await this.queue; return structuredClone(await this.load()); }
    mutate(fn) {
        const operation = this.queue.then(async () => {
            const draft = structuredClone(await this.load());
            const result = await fn(draft);
            await fs.mkdir(path.dirname(this.filename), { recursive: true });
            const temporary = `${this.filename}.${process.pid}.tmp`;
            try {
                await fs.writeFile(temporary, JSON.stringify(draft), { mode: 0o600 });
                await fs.rename(temporary, this.filename);
            } catch (error) {
                await fs.unlink(temporary).catch(() => {});
                throw error;
            }
            this.state = draft;
            return structuredClone(result);
        });
        this.queue = operation.catch(() => {});
        return operation;
    }
}
module.exports = { SupportStore };
