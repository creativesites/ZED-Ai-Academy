/**
 * Server-side EmailJS REST API wrapper.
 *
 * Template IDs are set in environment variables so you can configure them in
 * the EmailJS dashboard without touching code. Each template receives the
 * params documented in the send* functions below.
 *
 * EmailJS dashboard → Email Templates — create one template per function,
 * then paste the template ID into .env.local.
 */

const EMAILJS_API = "https://api.emailjs.com/api/v1.0/email/send";

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID ?? "service_ecfpcgk";
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY ?? "6c9PxVa7E_2DcRPVf";
const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY!;

async function sendEmail(templateId: string | undefined, params: Record<string, string>) {
  if (!PRIVATE_KEY || !templateId) {
    return;
  }

  const res = await fetch(EMAILJS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: templateId,
      user_id: PUBLIC_KEY,
      accessToken: PRIVATE_KEY,
      template_params: params,
    }),
  });

  if (!res.ok) {
    console.error("EmailJS error:", res.status, await res.text());
  }
}

/**
 * Sent when a user successfully enrolls in a course.
 *
 * Template variables:
 *   {{to_email}}   — recipient
 *   {{to_name}}    — first name
 *   {{course_title}} — course name
 *   {{course_url}} — link to /courses/[slug]/learn
 */
export async function sendEnrollmentConfirmation({
  toEmail,
  toName,
  courseTitle,
  courseUrl,
}: {
  toEmail: string;
  toName: string;
  courseTitle: string;
  courseUrl: string;
}) {
  const templateId = process.env.EMAILJS_TEMPLATE_ENROLLMENT;
  await sendEmail(templateId, {
    to_email: toEmail,
    to_name: toName,
    course_title: courseTitle,
    course_url: courseUrl,
  });
}

/**
 * Sent when a certificate is issued.
 *
 * Template variables:
 *   {{to_email}}    — recipient
 *   {{to_name}}     — first name
 *   {{course_title}} — course name
 *   {{cert_url}}    — public certificate link
 */
export async function sendCertificateIssued({
  toEmail,
  toName,
  courseTitle,
  certUrl,
}: {
  toEmail: string;
  toName: string;
  courseTitle: string;
  certUrl: string;
}) {
  const templateId = process.env.EMAILJS_TEMPLATE_CERTIFICATE;
  await sendEmail(templateId, {
    to_email: toEmail,
    to_name: toName,
    course_title: courseTitle,
    cert_url: certUrl,
  });
}

/**
 * Sent when a new account is created (via Clerk webhook).
 *
 * Template variables:
 *   {{to_email}} — recipient
 *   {{to_name}}  — first name or full name
 */
export async function sendWelcomeEmail({
  toEmail,
  toName,
}: {
  toEmail: string;
  toName: string;
}) {
  const templateId = process.env.EMAILJS_TEMPLATE_WELCOME;
  await sendEmail(templateId, {
    to_email: toEmail,
    to_name: toName,
  });
}

/**
 * Sent when a paid order is confirmed.
 *
 * Template variables:
 *   {{to_email}}     — recipient
 *   {{to_name}}      — first name
 *   {{course_title}} — course name
 *   {{amount}}       — formatted amount, e.g. "ZMW 299"
 *   {{course_url}}   — link to /courses/[slug]/learn
 */
export async function sendPaymentConfirmation({
  toEmail,
  toName,
  courseTitle,
  amount,
  courseUrl,
}: {
  toEmail: string;
  toName: string;
  courseTitle: string;
  amount: string;
  courseUrl: string;
}) {
  const templateId = process.env.EMAILJS_TEMPLATE_PAYMENT;
  await sendEmail(templateId, {
    to_email: toEmail,
    to_name: toName,
    course_title: courseTitle,
    amount,
    course_url: courseUrl,
  });
}
