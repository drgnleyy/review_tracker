window.supabaseClient = {
    client: null,
    init(url = window.SUPABASE_URL, anonKey = window.SUPABASE_ANON_KEY) {
        if (!url || !anonKey) {
            console.warn('Supabase URL or anon key not provided. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in index.html');
            return null;
        }
        if (!window.supabase || !window.supabase.createClient) {
            console.warn('Supabase library not found. Make sure the UMD script is loaded before this file.');
            return null;
        }
        this.client = window.supabase.createClient(url, anonKey);
        return this.client;
    },
    // Auth helpers (Supabase JS v2 style)
    async signUp(email, password, metadata = {}) {
        if (!this.client) throw new Error('Supabase not initialized');
        const res = await this.client.auth.signUp({ email, password }, { data: metadata });
        if (res.error) throw res.error;
        return res.data;
    },
    async signIn(email, password) {
        if (!this.client) throw new Error('Supabase not initialized');
        const res = await this.client.auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
        return res.data;
    },
    async signOut() {
        if (!this.client) return;
        await this.client.auth.signOut();
    },
    async getUser() {
        if (!this.client) return null;
        const res = await this.client.auth.getUser();
        if (res.error) throw res.error;
        return res.data.user || null;
    },

    // Basic DB helpers for `drills` and `goals` tables. Assumes tables exist with a `user_email` or `user_id` column.
    async fetchDrillsForEmail(email) {
        if (!this.client) return { data: null, error: new Error('Supabase not initialized') };
        return await this.client.from('drills').select('*').eq('user_email', email);
    },
    async fetchGoalsForEmail(email) {
        if (!this.client) return { data: null, error: new Error('Supabase not initialized') };
        return await this.client.from('goals').select('*').eq('user_email', email);
    },
    // Sync arrays to Supabase using upsert on `id` (recommended: make `id` primary key in table)
    async syncDrills(drills) {
        if (!this.client) return { data: null, error: new Error('Supabase not initialized') };
        return await this.client.from('drills').upsert(drills, { onConflict: 'id' });
    },
    async syncGoals(goals) {
        if (!this.client) return { data: null, error: new Error('Supabase not initialized') };
        return await this.client.from('goals').upsert(goals, { onConflict: 'id' });
    }
};