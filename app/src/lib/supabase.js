import { createClient } from '@supabase/supabase-js'

// The publishable key is designed to be public: all data is protected by Row Level Security.
// Secret keys (WhatsApp, service role) NEVER go in this app – they live on the server only.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://yqtuduxhbqkagzactrny.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vvqSpn8RCes6ObWZKtQP6g_XxWIatEn'

export const supabase = createClient(url, key)
