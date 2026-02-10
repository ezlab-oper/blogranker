import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1zlFFPQVJIbMvZqbFVVTZVx77F16sqrAp8D7PHBim39w';

// Sheet name → program name mapping (column E)
const SHEET_PROGRAM_MAP: Record<string, string> = {
  '이지캡쳐': '이지캡쳐',
  '이지집': '이지집',
  '이지파인더': '이지파인더',
  '이지메모': '이지메모',
  '이지캠': '이지캠',
  '이지리더': '이지리더',
};

// Extract blog ID from URL
function extractBlogId(url: string): string | null {
  try {
    const u = new URL(url);
    // Naver blog: blog.naver.com/{blogId}/... 
    if (u.hostname === 'blog.naver.com' || u.hostname === 'm.blog.naver.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || null;
    }
    // Tistory: {blogId}.tistory.com
    if (u.hostname.endsWith('.tistory.com')) {
      return u.hostname.replace('.tistory.com', '');
    }
    // Velog: velog.io/@{blogId}
    if (u.hostname === 'velog.io') {
      const match = u.pathname.match(/^\/@([^/]+)/);
      return match ? match[1] : null;
    }
    // Default: use hostname as ID
    return u.hostname;
  } catch {
    return null;
  }
}

// Custom base64 decoder that's more lenient than atob
function base64Decode(input: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Map<string, number>();
  for (let i = 0; i < chars.length; i++) lookup.set(chars[i], i);
  lookup.set('=', 0);
  
  // Filter to only valid base64 characters
  const clean = input.split('').filter(c => lookup.has(c) || c === '=').join('');
  
  const len = clean.length;
  let outLen = Math.floor(len * 3 / 4);
  if (clean[len - 1] === '=') outLen--;
  if (clean[len - 2] === '=') outLen--;
  
  const out = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup.get(clean[i]) || 0;
    const b = lookup.get(clean[i + 1]) || 0;
    const c = lookup.get(clean[i + 2]) || 0;
    const d = lookup.get(clean[i + 3]) || 0;
    out[p++] = (a << 2) | (b >> 4);
    if (p < outLen) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < outLen) out[p++] = ((c & 3) << 6) | (d & 63);
  }
  return out;
}

// Create signed JWT for Google Service Account auth
async function getAccessToken(email: string, privateKeyPem: string): Promise<string> {
  // Handle escaped newlines from secret storage
  let cleanKey = privateKeyPem.replace(/\\n/g, '\n');
  
  // Extract base64 content from PEM
  const b64 = cleanKey
    .replace(/-+BEGIN PRIVATE KEY-+/g, '')
    .replace(/-+END PRIVATE KEY-+/g, '')
    .replace(/[^A-Za-z0-9+/=]/g, '');
  
  // Truncate to valid length (multiple of 4)
  const validLen = b64.length - (b64.length % 4);
  const trimmed = b64.substring(0, validLen);
  
  // Decode key using lenient decoder
  const keyBytes = base64Decode(trimmed);
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Build JWT
  const toBase64Url = (data: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const encodeJson = (obj: unknown): string =>
    toBase64Url(new TextEncoder().encode(JSON.stringify(obj)));

  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeJson({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  });

  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed [${res.status}]: ${errText}`);
  }
  const data = await res.json();
  return data.access_token;
}



async function fetchSheetColumn(
  accessToken: string,
  sheetName: string,
  column: string = 'E'
): Promise<string[]> {
  const range = encodeURIComponent(`${sheetName}!${column}:${column}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Failed to fetch sheet ${sheetName}: ${errText}`);
    return [];
  }
  const data = await res.json();
  const values: string[][] = data.values || [];
  // Skip header row, filter valid URLs
  return values
    .slice(1)
    .map(row => (row[0] || '').trim())
    .filter(v => v.startsWith('http'));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Service account email (not sensitive - safe to include in code)
    const email = 'ezlab-368@ezlab-468909.iam.gserviceaccount.com';
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    if (!privateKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get access token
    const accessToken = await getAccessToken(email, privateKey);

    // Fetch URLs from all sheets
    const allUrls: { program: string; blog_url: string; blog_id: string | null }[] = [];

    for (const [sheetName, program] of Object.entries(SHEET_PROGRAM_MAP)) {
      const urls = await fetchSheetColumn(accessToken, sheetName);
      for (const url of urls) {
        allUrls.push({
          program,
          blog_url: url,
          blog_id: extractBlogId(url),
        });
      }
    }

    // Clear existing and insert fresh data
    await supabase.from('blog_urls').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (allUrls.length > 0) {
      // Insert in batches of 500
      for (let i = 0; i < allUrls.length; i += 500) {
        const batch = allUrls.slice(i, i + 500);
        const { error } = await supabase.from('blog_urls').insert(batch);
        if (error) {
          console.error('Insert error:', error);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: allUrls.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
