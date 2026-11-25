
import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Встав свої дані з Supabase
const SUPABASE_URL = "https://owbaowzqvmgvcofneqmg.supabase.co";
const SUPABASE_KEY = "sb_publishable_NjBXvNZbZLBGQV2_-b_6WA_6VNRK8yG";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);