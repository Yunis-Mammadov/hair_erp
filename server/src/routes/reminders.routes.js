const router = require("express").Router(),
  { prisma } = require("../prismaClient"),
  F = require("../financial-core"),
  R = require("../records-core"),
  M = require("../reminders"),
  S = require("../statements");
const { requireRole } = require("../middleware/auth.middleware");
router.use(requireRole("ADMIN"));
router.get(
  "/customers/:id/reminders",
  R.route(async (req, res) => {
    const id = F.id(req.params.id);
    await R.allowedCustomer(prisma, req, id);
    const jobs = await prisma.reminderOutbox.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({
      enabled: M.configured() && !req.company.isDemo,
      jobs: jobs.map(M.publicJob),
    });
  }),
);
router.get(
  "/customers/:id/reminder-preview",
  R.route(async (req, res) =>
    res.json(
      await prisma.$transaction(
        (tx) => M.preview(tx, req, F.id(req.params.id), S.language(req)),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  ),
);
router.post(
  "/customers/:id/reminders",
  R.route(async (req, res) => {
    if (req.company.isDemo)
      throw F.fail(403, "Demo accounts cannot send email.", "DEMO_RESTRICTED");
    if (!M.configured())
      throw F.fail(
        503,
        "Email reminders are not configured.",
        "REMINDERS_DISABLED",
      );
    const input = {
      customerId: F.id(req.params.id),
      locale: S.language(req),
      debt: F.money(req.body?.debt),
      recipient: M.email(req.body?.recipient),
    };
    const result = await F.mutate(req, "reminder", input, async (tx) => {
      await F.lockCustomer(tx, input.customerId, req);
      const preview = await M.preview(tx, req, input.customerId, input.locale);
      if (
        F.minor(preview.debt) !== F.minor(input.debt) ||
        preview.recipient !== input.recipient
      )
        throw F.fail(
          409,
          "The balance or recipient changed. Preview the reminder again.",
          "REMINDER_CHANGED",
        );
      const day = new Date(Date.now() - 86400000);
      if (
        await tx.reminderOutbox.count({
          where: {
            customerId: input.customerId,
            createdAt: { gte: day },
            state: { in: ["PENDING", "SENDING", "SENT", "UNKNOWN"] },
          },
        })
      )
        throw F.fail(
          429,
          "Only one reminder per customer is allowed in 24 hours.",
        );
      if (
        (await tx.reminderOutbox.count({
          where: { createdAt: { gte: day } },
        })) >= 100
      )
        throw F.fail(
          429,
          "Company reminder limit reached. Try again tomorrow.",
        );
      const job = await tx.reminderOutbox.create({
        data: {
          customerId: input.customerId,
          recipient: preview.recipient,
          locale: preview.locale,
          debtCents: BigInt(F.minor(preview.debt)),
          subject: preview.subject,
          body: preview.body,
        },
      });
      return { job: M.publicJob(job) };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }),
);
module.exports = router;
