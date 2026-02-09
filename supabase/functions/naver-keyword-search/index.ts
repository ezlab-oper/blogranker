import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateSignature(
  timestamp: string,
  method: string,
  uri: string,
  secretKey: string
): string {
  const message = `${timestamp}.${method}.${uri}`;
  const encoder = new TextEncoder();
  const key = encoder.encode(secretKey);
  const msg = encoder.encode(message);

  // Use Web Crypto API for HMAC-SHA256
  return "";
}

async function generateSignatureAsync(
  timestamp: string,
  method: string,
  uri: string,
  secretKey: string
): Promise<string> {
  const message = `${timestamp}.${method}.${uri}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64Encode(new Uint8Array(signature));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keywords } = await req.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return new Response(
        JSON.stringify({ error: "keywords 배열이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("NAVER_AD_API_KEY")!;
    const SECRET_KEY = Deno.env.get("NAVER_AD_SECRET_KEY")!;
    const CUSTOMER_ID = Deno.env.get("NAVER_AD_CUSTOMER_ID")!;

    const BASE_URL = "https://api.naver.com";
    const uri = "/keywordstool";
    const method = "GET";
    const timestamp = String(Date.now());

    const signature = await generateSignatureAsync(timestamp, method, uri, SECRET_KEY);

    // Build query params - join keywords with comma
    const hintKeywords = keywords.join(",");
    const params = new URLSearchParams({
      hintKeywords,
      showDetail: "1",
    });

    const response = await fetch(`${BASE_URL}${uri}?${params.toString()}`, {
      method: "GET",
      headers: {
        "X-Timestamp": timestamp,
        "X-API-KEY": API_KEY,
        "X-Customer": CUSTOMER_ID,
        "X-Signature": signature,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Naver API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Naver API error: ${response.status}`, detail: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
