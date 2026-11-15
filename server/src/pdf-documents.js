const PDFDocument = require("pdfkit"),
  path = require("node:path"),
  F = require("./financial-core"),
  Q = require("./quantity");
const messages = require("../../shared/messages.json");
function create(locale, render) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 42,
        bufferPages: true,
        info: { Title: "z-Index business document", Creator: "z-Index" },
      }),
      chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.registerFont(
      "Regular",
      path.join(__dirname, "../assets/fonts/DejaVuSans.ttf"),
    );
    doc.registerFont(
      "Bold",
      path.join(__dirname, "../assets/fonts/DejaVuSans-Bold.ttf"),
    );
    doc.font("Regular").fontSize(9).fillColor("#182238");
    const t = (key) => messages[key]?.[locale] || messages[key]?.en || key,
      loc =
        { en: "en-US", az: "az-AZ", tr: "tr-TR", ru: "ru-RU" }[locale] ||
        "en-US";
    const money = (value, currency) =>
      new Intl.NumberFormat(loc, { style: "currency", currency }).format(
        Number(value || 0),
      );
    const date = (value, zone) =>
      new Intl.DateTimeFormat(loc, {
        dateStyle: "medium",
        timeZone: zone || "UTC",
      }).format(new Date(value));
    const page = () => {
      doc.addPage();
      doc.font("Regular").fontSize(9).fillColor("#182238");
    };
    const ensure = (h) => {
      if (doc.y + h > doc.page.height - 65) page();
    };
    const text = (value, { bold = false, size = 9, ...opts } = {}) => {
      doc
        .font(bold ? "Bold" : "Regular")
        .fontSize(size)
        .text(String(value ?? ""), { width: doc.page.width - 84, ...opts });
      doc.font("Regular").fontSize(9);
    };
    function table(headers, rows, widths) {
      const x = 42,
        w = doc.page.width - 84;
      function row(cells, head = false) {
        doc.font(head ? "Bold" : "Regular").fontSize(head ? 8 : 8.5);
        const heights = cells.map((c, i) =>
          doc.heightOfString(String(c ?? ""), {
            width: w * widths[i] - 12,
            lineGap: 2,
          }),
        );
        const h = Math.max(28, ...heights.map((v) => v + 14));
        if (h > 650) throw F.fail(413, "A document row is too long to render.");
        if (doc.y + h > doc.page.height - 65) {
          page();
          if (!head) row(headers, true);
        }
        doc.font(head ? "Bold" : "Regular").fontSize(head ? 8 : 8.5);
        const y = doc.y;
        doc.rect(x, y, w, h).fill(head ? "#edf1f7" : "#ffffff");
        let left = x;
        cells.forEach((cell, i) => {
          doc
            .fillColor("#182238")
            .text(String(cell ?? ""), left + 6, y + 7, {
              width: w * widths[i] - 12,
              lineGap: 2,
              align: i >= cells.length - 3 ? "right" : "left",
            });
          left += w * widths[i];
        });
        doc
          .moveTo(x, y + h)
          .lineTo(x + w, y + h)
          .strokeColor("#dce2ed")
          .stroke();
        doc.y = y + h;
        doc.x = x;
      }
      row(headers, true);
      rows.forEach((c) => row(c));
      doc.moveDown();
    }
    try {
      render({ doc, t, money, date, text, table, ensure });
      const pages = doc.bufferedPageRange();
      for (let n = pages.start; n < pages.start + pages.count; n++) {
        doc.switchToPage(n);
        doc
          .font("Regular")
          .fontSize(8)
          .fillColor("#64748b")
          .text(`${n + 1} / ${pages.count}`, 42, doc.page.height - 55, {
            width: doc.page.width - 84,
            align: "right",
            lineBreak: false,
          });
      }
      doc.end();
    } catch (e) {
      reject(e);
      doc.destroy();
    }
  });
}
function invoice(order, locale = "en") {
  return create(locale, ({ doc, t, money, date, text, table, ensure }) => {
    const company = order.companySnapshot || {},
      customer = order.customerSnapshot || order.customer || {},
      currency = order.currency || company.currency || "USD";
    text(company.name || "z-Index", { bold: true, size: 20 });
    for (const line of [company.address, company.phone, company.taxId])
      if (line) text(line);
    doc.moveDown();
    text(
      t("Sales invoice") +
        " " +
        (order.invoiceNumber || String(order.orderNumber).padStart(5, "0")),
      { bold: true, size: 14 },
    );
    text(date(order.createdAt, company.timezone));
    doc.moveDown();
    text(t("Customer") + ": " + customer.name, { bold: true });
    for (const line of [customer.salon, customer.phone, customer.address])
      if (line) text(line);
    text(t("Customer ID") + ": " + (customer.id || order.customerId));
    text(
      t("Recorded by") +
        ": " +
        (company.issuedBy || order.createdBy?.fullName || "-"),
    );
    doc.moveDown();
    table(
      ["#", t("Product"), t("Quantity"), t("Unit price"), t("Total")],
      order.items.map((i, n) => [
        n + 1,
        (i.productName || i.product?.name || "-") +
          (i.productSku ? "\n" + i.productSku : "") +
          (i.isGift ? "\n" + t("Gift") : ""),
        i.quantity + " " + t(i.unit || "PIECE"),
        money(i.unitPrice, currency),
        money(
          i.lineTotalAmount == null
            ? i.isGift
              ? 0
              : Q.lineCents(F.minor(i.unitPrice), i.quantity) / 100
            : i.lineTotalAmount,
          currency,
        ),
      ]),
      [0.06, 0.35, 0.15, 0.22, 0.22],
    );
    ensure(130);
    for (const [label, value] of [
      ["Subtotal", order.subtotalAmount ?? order.totalAmount],
      ["Discount", order.discountAmount],
      ["Tax", order.taxAmount],
    ])
      text(`${t(label)}: ${money(value, currency)}`, { align: "right" });
    text(t("Total") + ": " + money(order.totalAmount, currency), {
      bold: true,
      size: 14,
      align: "right",
    });
    for (const [label, value] of [
      ["Returns", order.allocatedReturn],
      ["Paid", order.allocatedPayment],
      ["Outstanding", order.remainingDebt],
    ])
      if (value != null)
        text(t(label) + ": " + money(value, currency), { align: "right" });
    if (order.note) {
      doc.moveDown();
      text(t("Note") + ": " + order.note);
    }
    for (const [label, image] of [
      ["Sender signature", order.sellerSignature],
      ["Recipient signature", order.customerSignature],
    ])
      if (image && /^data:image\/png;base64,/.test(image)) {
        ensure(75);
        text(t(label));
        doc.image(Buffer.from(image.split(",")[1], "base64"), 42, doc.y, {
          fit: [160, 45],
        });
        doc.y += 50;
      }
  });
}
function statement(data, locale = "en") {
  return create(locale, ({ doc, t, money, date, text, table, ensure }) => {
    text(data.company.name, { bold: true, size: 20 });
    text(t("Account statement"), { bold: true, size: 15 });
    text(data.customer.name, { bold: true, size: 11 });
    for (const value of [
      data.customer.salon,
      data.customer.phone,
      data.customer.address,
    ])
      if (value) text(value);
    text(
      (data.startDate || t("All dates")) +
        " - " +
        (data.endDate || date(data.generatedAt, data.timezone)),
    );
    text(t("Recorded transactions; negative balance means customer credit."));
    doc.moveDown();
    text(
      t("Opening balance") + ": " + money(data.openingBalance, data.currency),
      { bold: true },
    );
    doc.moveDown();
    table(
      [
        t("Date"),
        t("Type"),
        t("Reference"),
        t("Debit"),
        t("Credit"),
        t("Balance"),
      ],
      data.rows.map((r) => [
        date(r.date, data.timezone),
        t(r.type),
        r.reference,
        money(r.debit, data.currency),
        money(r.credit, data.currency),
        money(r.balance, data.currency),
      ]),
      [0.17, 0.18, 0.17, 0.16, 0.16, 0.16],
    );
    ensure(100);
    text(t("Debits") + ": " + money(data.debits, data.currency), {
      align: "right",
    });
    text(t("Credits") + ": " + money(data.credits, data.currency), {
      align: "right",
    });
    text(
      t("Closing balance") + ": " + money(data.closingBalance, data.currency),
      { bold: true, size: 13, align: "right" },
    );
  });
}
module.exports = { invoice, statement };
