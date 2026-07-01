const { createClient } = require("@supabase/supabase-js");

let cached = null;

function getServiceClient() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY env var.");
  }

  cached = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return cached;
}

module.exports = { getServiceClient };
