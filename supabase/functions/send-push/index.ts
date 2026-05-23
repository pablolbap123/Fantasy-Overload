import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

const encoder = new TextEncoder();

const base64Url = (input: string | ArrayBuffer) => {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const importPrivateKey = async (privateKey: string) => {
  const normalized = privateKey
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
};

const getFirebaseAccessToken = async (serviceAccount: ServiceAccount) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(signingInput));
  const assertion = `${signingInput}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`firebase_auth_failed_${response.status}`);
  }
  const data = await response.json();
  return data.access_token as string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !serviceAccountJson) {
      return new Response(JSON.stringify({ error: "missing_push_env" }), { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401, headers: corsHeaders });
    }

    const input = await req.json();
    const leagueId = String(input.leagueId ?? "");
    const userIds = Array.isArray(input.userIds) ? [...new Set(input.userIds.map(String).filter(Boolean))] : [];
    const title = String(input.title ?? "OverloadFantasy");
    const body = String(input.body ?? "");
    const data = Object.fromEntries(
      Object.entries(input.data ?? {}).map(([key, value]) => [key, String(value ?? "")]),
    );

    if (!leagueId || userIds.length === 0 || !body) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers: corsHeaders });
    }

    const { data: senderMembership } = await serviceClient
      .from("league_members")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (!senderMembership) {
      return new Response(JSON.stringify({ error: "not_member" }), { status: 403, headers: corsHeaders });
    }

    const { data: allowedRecipients, error: memberError } = await serviceClient
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId)
      .in("user_id", userIds);
    if (memberError) throw memberError;

    const allowedUserIds = (allowedRecipients ?? []).map((row) => row.user_id);
    if (allowedUserIds.length === 0) return new Response(JSON.stringify({ sent: 0, failed: 0 }), { headers: corsHeaders });

    const { data: subscriptions, error: tokenError } = await serviceClient
      .from("push_subscriptions")
      .select("id, token")
      .in("user_id", allowedUserIds);
    if (tokenError) throw tokenError;
    if (!subscriptions?.length) return new Response(JSON.stringify({ sent: 0, failed: 0 }), { headers: corsHeaders });

    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    let sent = 0;
    let failed = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${accessToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: subscription.token,
                notification: { title, body },
                data,
                android: {
                  priority: "high",
                  notification: {
                    channel_id: "overload_fantasy",
                    sound: "default",
                  },
                },
              },
            }),
          },
        );
        if (response.ok) {
          sent += 1;
          return;
        }
        failed += 1;
        if ([400, 404].includes(response.status)) {
          await serviceClient.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }),
    );

    return new Response(JSON.stringify({ sent, failed }), { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: corsHeaders });
  }
});
