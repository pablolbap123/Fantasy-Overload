import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    const email = body.user?.email;
    const tokenHash = body.email_data?.token_hash;
    const type = body.email_data?.email_action_type;
    const redirectTo = body.email_data?.redirect_to;

    const confirmationUrl =
      `https://ipegwbbiluryviechkssc.supabase.co/auth/v1/verify?token=${tokenHash}&type=${type}&redirect_to=${redirectTo}`;

    const { error } = await resend.emails.send({
     from: "Overload Fantasy <noreply@overloadfantasy.com>",
      to: email,
      subject: "Confirma tu cuenta",
      html: `
        <h2>Confirma tu cuenta</h2>
        <p>Pulsa aquí para confirmar tu email:</p>
        <a href="${confirmationUrl}">Confirmar cuenta</a>
      `,
    });

    if (error) {
      console.error(error);
      return new Response(JSON.stringify(error), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});