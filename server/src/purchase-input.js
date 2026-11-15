const F = require("./financial-core");
const Q = require("./quantity");
const W = require("./workspace-core");

function readPurchase(req) {
  const body = req.body || {};
  const supplier = F.text(body.supplier, 200);

  if (!supplier) {
    throw F.fail(400, "Təchizatçının adını yaz.");
  }

  const purchaseDate =
    body.purchaseDate ??
    W.localDay(new Date(), req.company.timezone);

  W.calendar(purchaseDate);

  if (
    purchaseDate >
    W.localDay(new Date(), req.company.timezone)
  ) {
    throw F.fail(
      400,
      "Alış tarixi gələcəkdə ola bilməz.",
    );
  }

  const items = F.lines(body.items).map((item) => {
    const unitCost = F.money(item.unitCost, true);

    if (item.productId && item.newProduct) {
      throw F.fail(
        400,
        "Mövcud və ya yeni məhsuldan birini seç.",
      );
    }

    if (item.productId) {
      return {
        productId: F.id(item.productId),
        quantity: Q.quantity(item.quantity),
        unitCost,
        salePrice: F.money(item.salePrice, true),
      };
    }

    if (req.user.role !== "ADMIN") {
      throw F.fail(
        403,
        "Yeni məhsulu yalnız administrator yarada bilər.",
      );
    }

    const p = item.newProduct;

    if (
      !p ||
      typeof p !== "object" ||
      Array.isArray(p)
    ) {
      throw F.fail(
        400,
        "Yeni məhsulun məlumatlarını yoxla.",
      );
    }

    const name = F.text(p.name, 150);
    const categoryId = p.categoryId
      ? F.id(p.categoryId)
      : null;

    const categoryName = F.text(p.categoryName, 150);

    if (
      !name ||
      Boolean(categoryId) === Boolean(categoryName)
    ) {
      throw F.fail(
        400,
        "Məhsul adı və bir kateqoriya seçimi tələb olunur.",
      );
    }

    const unit = Q.unit(p.unit);

    return {
      newProduct: {
        name,
        categoryId,
        categoryName,
        unit,
        sku: F.text(p.sku, 80),
        barcode: F.text(p.barcode, 80),
        salePrice: F.money(p.salePrice, true),
      },
      quantity: Q.quantity(item.quantity, unit),
      unitCost,
    };
  });

  return {
    supplier,
    purchaseDate,
    items,
    invoiceNo: F.text(body.invoiceNo, 100),
    note: F.text(body.note),
  };
}

async function recordPurchase(tx, req, input) {
  const resolved = [];

  for (const item of input.items) {
    let product;

    if (item.newProduct) {
      const {
        categoryId,
        categoryName,
        ...data
      } = item.newProduct;

      let category = categoryId
        ? await tx.category.findUnique({
            where: { id: categoryId },
          })
        : await tx.category.findFirst({
            where: {
              name: {
                equals: categoryName,
                mode: "insensitive",
              },
            },
          });

      if (categoryId && !category) {
        throw F.fail(400, "Kateqoriya tapılmadı.");
      }

      if (!category) {
        category = await tx.category.create({
          data: { name: categoryName },
        });
      }

      const existing = await tx.product.findFirst({
        where: {
          categoryId: category.id,
          name: {
            equals: data.name,
            mode: "insensitive",
          },
        },
      });

      if (existing) {
        throw F.fail(
          409,
          "Məhsul bu kateqoriyada artıq var. Mövcud məhsullardan seç.",
        );
      }

      for (const field of ["sku", "barcode"]) {
        if (
          data[field] &&
          await tx.product.findFirst({
            where: { [field]: data[field] },
          })
        ) {
          throw F.fail(
            409,
            "SKU və ya barkod artıq istifadə olunur.",
          );
        }
      }

      product = await tx.product.create({
        data: {
          ...data,
          categoryId: category.id,
        },
      });
    } else {
      product = await tx.product.findFirst({
        where: {
          id: item.productId,
          archivedAt: null,
        },
      });

      if (!product) {
        throw F.fail(
          400,
          "Məhsul tapılmadı və ya arxivdədir.",
        );
      }

      if (
        req.user.role !== "ADMIN" &&
        F.minor(item.salePrice) !==
          F.minor(product.salePrice)
      ) {
        throw F.fail(
          403,
          "Satış qiymətini yalnız administrator dəyişə bilər.",
        );
      }

      if (req.user.role === "ADMIN") {
        await tx.product.update({
          where: { id: product.id },
          data: { salePrice: item.salePrice },
        });
      }
    }

    Q.quantity(item.quantity, product.unit);

    if (
      resolved.some(
        (row) => row.productId === product.id,
      )
    ) {
      throw F.fail(
        400,
        "Eyni məhsulu bir sətirdə qeyd et.",
      );
    }

    resolved.push({
      productId: product.id,
      quantity: item.quantity,
      unitCost: item.unitCost,
    });
  }

  const purchase = await tx.purchase.create({
    data: {
      createdById: req.user.id,
      supplier: input.supplier,
      invoiceNo: input.invoiceNo,
      note: input.note,
      purchaseDate: W.calendar(input.purchaseDate),
      items: { create: resolved },
    },
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
      items: {
        include: {
          product: {
            include: { category: true },
          },
        },
      },
    },
  });

  for (const item of resolved) {
    await F.moveStock(
      tx,
      item.productId,
      item.quantity,
      {
        user: req.user,
        kind: "PURCHASE",
        documentId: purchase.id,
        reason:
          `Alış ${input.purchaseDate} · ${input.supplier}`,
      },
    );
  }

  return { purchase };
}

module.exports = {
  readPurchase,
  recordPurchase,
};