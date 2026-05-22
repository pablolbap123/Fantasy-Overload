import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const hookSecret = Deno.env
  .get("SEND_EMAIL_HOOK_SECRET")!
  .replace("v1,whsec_", "");

Deno.serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    const confirmationUrl = `https://ipegwbbiuryviechkssc.supabase.co/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${email_data.redirect_to}`;

    const { error } = await resend.emails.send({
      from: "Overload Fantasy <onboarding@resend.dev>",
      to: [user.email],
      subject: "Confirma tu email",
      html: `
        <h2>Confirma tu email</h2>
        <p>Haz clic aquí para confirmar tu cuenta:</p>
        <a href="${confirmationUrl}">Confirmar cuenta</a>
        <p>O usa este código: ${email_data.token}</p>
      `,
    });

    if (error) throw error;

    return new Response(JSON.stringify({}), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
});