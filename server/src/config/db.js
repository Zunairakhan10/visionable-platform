const { createClient } = require('@supabase/supabase-js');

let supabase;

function getSupabase() {
  if (supabase) {
    return supabase;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('SUPABASE_URL must be a valid HTTPS URL.');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('SUPABASE_URL must use HTTPS.');
  }

  const path = parsedUrl.pathname.replace(/\/+$/, '');
  if (path && path !== '/rest/v1') {
    throw new Error('SUPABASE_URL must be the project URL or its REST endpoint URL.');
  }
  if (parsedUrl.search || parsedUrl.hash || parsedUrl.username || parsedUrl.password) {
    throw new Error('SUPABASE_URL must not include query, fragment, or credentials.');
  }

  supabase = createClient(parsedUrl.origin, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return supabase;
}

async function connectDB() {
  const client = getSupabase();
  const { error } = await client
    .from('monitoring_events')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`Supabase connection check failed (${error.code || 'query error'}).`);
  }

  const { error: roleTableError } = await client
    .from('user_roles')
    .select('user_id')
    .limit(1);

  if (roleTableError) {
    throw new Error(`Supabase role configuration check failed (${roleTableError.code || 'query error'}).`);
  }

  console.log('Connected to Supabase.');
}

module.exports = { connectDB, getSupabase };
