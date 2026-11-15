const F = require("./financial-core"),
  { prisma, platformPrisma } = require("./prismaClient"),
  { runWithCompany } = require("./tenant-context");
const { subscriptionIsActive } = require("./config/plans");
const email = (value) => {
  if (value == null || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(
      value,
    )
  )
    throw F.fail(400, "Enter a valid customer email.");
  return value.trim().toLowerCase();
};
function contact(input, existing = {}) {
  const next = {};
  if (input.email !== undefined) next.email = email(input.email);
  if (input.reminderOptIn !== undefined) {
    if (typeof input.reminderOptIn !== "boolean")
      throw F.fail(400, "Reminder consent must be true or false.");
    next.reminderOptIn = input.reminderOptIn;
    next.reminderConsentAt = input.reminderOptIn
      ? existing.reminderOptIn
        ? existing.reminderConsentAt
        : new Date()
      : null;
  }
  if (next.email !== undefined && next.email !== existing.email) {
    next.reminderOptIn = input.reminderOptIn === true;
    next.reminderConsentAt = next.reminderOptIn ? new Date() : null;
  }
  if (
    (next.reminderOptIn ?? existing.reminderOptIn) &&
    !(next.email ?? existing.email)
  )
    throw F.fail(400, "Enter an email before enabling reminders.");
  return next;
}
function configured(env = process.env) {
  if (!(
    env.REMINDERS_ENABLED === "true" &&
    env.SMTP_HOST &&
    env.SMTP_FROM &&
    env.SMTP_USER &&
    env.SMTP_PASSWORD
  ))
    return false;
  try {
    email(env.SMTP_FROM);
    return [465, 587].includes(Number(env.SMTP_PORT || 587));
  } catch {
    return false;
  }
}
function transport(env = process.env) {
  if (!configured(env))
    throw F.fail(
      503,
      "Email reminders are not configured.",
      "REMINDERS_DISABLED",
    );
  email(env.SMTP_FROM);
  const port = Number(env.SMTP_PORT || 587);
  if (![465, 587].includes(port))
    throw F.fail(503, "SMTP must use port 465 or 587.", "SMTP_CONFIGURATION");
  return require("nodemailer").createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
const copy = {
  en: {
    subject: "Payment reminder",
    greeting: "Hello",
    balance: "Your outstanding balance with",
    end: "Please contact us if you have already paid or need assistance. Thank you.",
  },
  az: {
    subject: "Ödəniş xatırlatması",
    greeting: "Salam",
    balance: "üzrə qalan borcunuz",
    end: "Artıq ödəmisinizsə və ya köməyə ehtiyacınız varsa, bizimlə əlaqə saxlayın. Təşəkkür edirik.",
  },
  tr: {
    subject: "Ödeme hatırlatması",
    greeting: "Merhaba",
    balance: "için kalan borcunuz",
    end: "Ödeme yaptıysanız veya yardıma ihtiyacınız varsa bizimle iletişime geçin. Teşekkürler.",
  },
  ru: {
    subject: "Напоминание об оплате",
    greeting: "Здравствуйте",
    balance: "Остаток задолженности перед",
    end: "Если вы уже оплатили или вам нужна помощь, свяжитесь с нами. Спасибо.",
  },
};
function message(customer, company, debt, locale = "en") {
  const c = copy[locale] || copy.en;
  const amount = new Intl.NumberFormat(
    { en: "en-US", az: "az-AZ", tr: "tr-TR", ru: "ru-RU" }[locale] || "en-US",
    { style: "currency", currency: company.currency },
  ).format(debt);
  return {
    recipient: customer.email,
    locale,
    subject: c.subject + " - " + company.name,
    body: `${c.greeting}, ${customer.name}.\n\n${c.balance} ${company.name}: ${amount}.\n\n${c.end}${company.phone ? "\n" + company.phone : ""}`,
    debt,
  };
}
function publicJob(job) {
  return {
    id: job.id,
    recipient: job.recipient,
    locale: job.locale,
    debt: Number(job.debtCents) / 100,
    subject: job.subject,
    state: job.state,
    createdAt: job.createdAt,
    sentAt: job.sentAt,
    lastError: job.lastError,
  };
}
async function preview(tx, req, id, locale) {
  const customer = await require("./records-core").allowedCustomer(tx, req, id),
    balance = await F.account(tx, id);
  if (!customer.email || !customer.reminderOptIn)
    throw F.fail(
      409,
      "Customer email and explicit reminder consent are required.",
      "REMINDER_CONSENT",
    );
  if (!balance.debt)
    throw F.fail(409, "This customer has no outstanding debt.", "NO_DEBT");
  return message(customer, req.company, balance.debt, locale);
}
async function processOne(db = platformPrisma, send, now = new Date()) {
  await db.reminderOutbox.updateMany({
    where: { state: "SENDING", startedAt: { lt: new Date(+now - 300000) } },
    data: {
      state: "UNKNOWN",
      lastError:
        "Delivery outcome is unknown. Verify delivery before creating a new reminder.",
    },
  });
  const job = await db.reminderOutbox.findFirst({
    where: { state: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!job) return false;
  const company = await db.company.findUnique({ where: { id: job.companyId } });
  let outgoing;
  await runWithCompany(job.companyId, () =>
    F.transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
          where: { id: job.customerId },
        }),
        account = await F.account(tx, job.customerId);
      let state;
      if (
        !company ||
        company.isDemo ||
        !subscriptionIsActive(company, now) ||
        !customer?.reminderOptIn ||
        customer.email !== job.recipient
      )
        state = "CANCELED";
      else if (BigInt(F.minor(account.debt)) !== job.debtCents || !account.debt)
        state = "STALE";
      if (state) {
        await tx.reminderOutbox.updateMany({
          where: { id: job.id, state: "PENDING" },
          data: { state },
        });
        return;
      }
      const claim = await tx.reminderOutbox.updateMany({
        where: { id: job.id, state: "PENDING" },
        data: { state: "SENDING", startedAt: now },
      });
      if (claim.count) outgoing = job;
    }),
  );
  if (!outgoing) return true;
  try {
    const info = await (send || ((mail) => transport().sendMail(mail)))({
      from: process.env.SMTP_FROM,
      to: job.recipient,
      subject: job.subject,
      text: job.body,
      messageId: `<reminder.${job.id}@z-index.invalid>`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (info.rejected?.length)
      throw Object.assign(Error("Recipient rejected"), { responseCode: 550 });
    await db.reminderOutbox.updateMany({
      where: { id: job.id, state: "SENDING" },
      data: {
        state: "SENT",
        sentAt: new Date(),
        messageId: info.messageId || null,
        lastError: null,
      },
    });
  } catch (e) {
    const definitive = Number(e.responseCode) >= 500;
    await db.reminderOutbox.updateMany({
      where: { id: job.id, state: "SENDING" },
      data: {
        state: definitive ? "FAILED" : "UNKNOWN",
        lastError: definitive
          ? "SMTP rejected the message. Check the recipient or provider."
          : "Delivery outcome is unknown. Verify delivery before creating a new reminder.",
      },
    });
  }
  return true;
}
function startWorker() {
  if (!configured()) return () => {};
  let busy = false,
    stopped = false;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      for (let n = 0; n < 5 && !stopped; n++) if (!(await processOne())) break;
    } catch {
      require("./ops/runtime").log("reminder_worker_error");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, 30000);
  timer.unref();
  tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
module.exports = {
  email,
  contact,
  configured,
  transport,
  message,
  publicJob,
  preview,
  processOne,
  startWorker,
};
