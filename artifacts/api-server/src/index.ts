import app from "./app";
import { logger } from "./lib/logger";
// Paused 2026-08-14 — see the matching note above app.listen() below for why.
// import { registerCommercialFollowupCron } from "./lib/commercial-followup/scheduler";
// import { registerInvoiceRemindersCron } from "./lib/invoice-reminders/scheduler";
// Also paused on merge (2026-08-17), same reasoning: no real subscriptions/
// invoices exist yet for these to act on until real PayPal credentials +
// webhook are configured (see PR #28). Reactivate alongside the two above.
// import { registerSubscriptionAlertsCron } from "./lib/subscription-alerts/scheduler";
// import { registerPaymentRecoveryCron } from "./lib/payment-recovery/scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Paused 2026-08-14 per Camila: no real clients yet, so these crons only
  // burn Neon compute for empty-result runs — not worth keeping an
  // always-on process awake for. Webhooks (/api/webhooks/paypal,
  // /api/webhooks/jotform, /api/webhooks/resend) are unaffected — they're
  // plain Express routes, not scheduled jobs. To reactivate: uncomment the
  // two lines below (and their imports at the top of this file) once there
  // are real prospects/invoices/subscriptions for these to act on.
  // registerCommercialFollowupCron();
  // registerInvoiceRemindersCron();
  // Also paused on merge (2026-08-17), same reasoning as above — see note
  // at the top of this file (PR #28).
  // registerSubscriptionAlertsCron();
  // registerPaymentRecoveryCron();
});
