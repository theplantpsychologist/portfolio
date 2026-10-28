// POST /api/contact: Cloudflare Pages Function behind the about page's form.
// Verifies Turnstile, then emails the message via Resend. The recipient
// address only exists here, as a secret, so it never appears in the page.
//
// Secrets/vars (Pages → Settings → Variables and Secrets):
//   TURNSTILE_SECRET_KEY, RESEND_API_KEY, CONTACT_TO, CONTACT_FROM

import { TOPICS } from "../../src/lib/contact";

interface Env {
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  CONTACT_TO: string;
  CONTACT_FROM: string; // e.g. "Portfolio <contact@yourdomain.com>", on a domain verified in Resend
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const wantsJson = request.headers.get("Accept")?.includes("application/json");
  const reply = (ok: boolean, message: string, status = ok ? 200 : 400) =>
    wantsJson
      ? Response.json({ ok, message }, { status })
      : Response.redirect(new URL(`/about/?sent=${ok ? 1 : 0}#contact`, request.url).toString(), 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(false, "Couldn't read the form.");
  }
  const field = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const name = field("name", 100);
  const email = field("email", 200);
  const topic = TOPICS.includes(field("topic", 50)) ? field("topic", 50) : "Other";
  const subject = field("subject", 150).replace(/\s+/g, " ");
  const message = field("message", 5000);

  // Bots fill every field; people never see this one.
  if (field("website", 200)) return reply(true, "Thanks! Your message was sent.");
  if (!name || !EMAIL.test(email) || message.length < 10) {
    return reply(false, "Please include your name, a valid email, and a message.");
  }

  const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: field("cf-turnstile-response", 2048),
      remoteip: request.headers.get("CF-Connecting-IP") ?? "",
    }),
  }).then((r) => r.json<{ success: boolean }>());
  if (!verify.success) return reply(false, "The spam check failed. Please reload the page and try again.");

  if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) {
    return reply(false, "The contact form isn't configured yet. Please try again later.", 503);
  }
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.CONTACT_FROM,
      to: [env.CONTACT_TO],
      reply_to: `${name.replace(/[<>"]/g, "")} <${email}>`,
      subject: `[${topic}] ${subject || `Message from ${name}`}`,
      text: `${message}\n\n— ${name} <${email}>\nTopic: ${topic}${subject ? `\nSubject: ${subject}` : ""}`,
    }),
  });
  if (!sent.ok) {
    console.error("Resend error", sent.status, await sent.text());
    return reply(false, "Sorry, the message couldn't be sent. Please try again later.", 502);
  }
  return reply(true, "Thanks! Your message was sent. I'll reply by email.");
};
