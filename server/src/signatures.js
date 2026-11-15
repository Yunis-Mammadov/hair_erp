const sharp = require('sharp');
const { createHash } = require('node:crypto');
const { Router } = require('express');
const { requireFeature, requireRole } = require('./middleware/auth.middleware');
const F = require('./financial-core');
const R = require('./records-core');

async function signatureImage(value) {
  if (typeof value !== 'string' || value.length > 280000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw F.fail(400, 'Choose a valid PNG signature.', 'INVALID_SIGNATURE');
  const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
  try {
    const image = sharp(bytes, { limitInputPixels: 1000000, animated: false });
    const metadata = await image.metadata();
    if (metadata.format !== 'png' || !metadata.width || !metadata.height ||
        metadata.width > 1600 || metadata.height > 600 || (metadata.pages || 1) !== 1)
      throw Error('Dimensions');
    const normalized = await image.png().toBuffer();
    if (normalized.length > 200000) throw Error('Size');
    return 'data:image/png;base64,' + normalized.toString('base64');
  } catch {
    throw F.fail(400, 'Choose a valid PNG signature.', 'INVALID_SIGNATURE');
  }
}

// Mounted inside the shared orders router: legacy aliases receive identical gates.
const router = Router();
for (const [path, field, dateField, roles, label] of [
  ['seller-signature', 'sellerSignature', 'sellerSignedAt', ['ADMIN'], 'Sender signature'],
  ['signature', 'customerSignature', 'signedAt', ['ADMIN', 'DRIVER'], 'Recipient signature'],
]) {
  router.post('/:id/' + path, requireFeature('deliverySignatures'), requireRole(...roles), R.route(async (req, res) => {
    const id = F.id(req.params.id), image = await signatureImage(req.body?.signature);
    const order = await F.transaction(async tx => {
      const current = await tx.order.findFirst({ where: { id, ...R.orderWhere(req) } });
      if (!current) throw F.fail(404, 'Invoice not found.');
      if (current[field]) {
        if (current[field] === image)
          return R.presentOrder(await tx.order.findUnique({ where: { id }, include: R.orderInclude }));
        throw F.fail(409, 'This signature is already recorded and cannot be replaced.', 'SIGNATURE_EXISTS');
      }
      const now = new Date();
      const saved = await tx.order.updateMany({ where: { id, [field]: current[field] }, data: { [field]: image, [dateField]: now } });
      if (saved.count !== 1) throw F.fail(409, 'The invoice changed. Refresh before continuing.');
      await tx.orderEditLog.create({ data: {
        orderId: id, editedById: req.user.id, reason: label + ' recorded',
        beforeSnapshot: { field, recorded: false },
        afterSnapshot: { field, recorded: true, at: now.toISOString(), sha256: createHash('sha256').update(image).digest('hex') },
      } });
      return R.presentOrder(await tx.order.findUnique({ where: { id }, include: R.orderInclude }));
    });
    res.json({ order });
  }));
}
module.exports = { router, signatureImage };
