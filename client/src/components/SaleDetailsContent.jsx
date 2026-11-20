import {
  Avatar, Box, Chip, Divider, Link, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useI18n } from '../i18n/useI18n';
import { formatNumber } from '../i18n/runtime';
import { invoiceLines, invoiceTotal } from '../lib/invoice.mjs';

const cardSx = {
  minWidth: 0, bgcolor: 'background.paper', border: '1px solid',
  borderColor: 'divider', borderRadius: '12px', overflow: 'hidden',
};

function Field({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ fontSize: 13, fontWeight: 500, overflowWrap: 'anywhere' }}>
        {children || '—'}
      </Box>
    </Box>
  );
}

function AmountRow({ label, value, strong = false }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: strong ? 700 : 500,
        textAlign: 'right', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}

export default function SaleDetailsContent({
  order, items, formatDate, googleMapsLink, wazeLink,
}) {
  const { t, money, currency: workspaceCurrency } = useI18n();
  if (!order) return null;

  const sourceItems = items || order.items || [];
  const rows = invoiceLines({ ...order, items: sourceItems });
  const customer = { ...order.customer, ...order.customerSnapshot };
  const company = order.companySnapshot || {};
  const currency = order.currency || company.currency || workspaceCurrency;
  const amount = value => value == null ? '—' : money(value, currency);
  const invoiceNumber = order.invoiceNumber || String(order.orderNumber || 0).padStart(5, '0');
  const hasBalance = order.remainingDebt != null;
  const debt = Number(order.remainingDebt || 0);
  const status = order.financialStatus || (debt <= 0 ? 'ODENIB'
    : Number(order.allocatedPayment || 0) > 0 || Number(order.allocatedReturn || 0) > 0
      ? 'QISMEN_ODENIB' : 'BORCLU');
  const statusColor = debt <= 0 ? 'success' : 'warning';
  const seller = company.issuedBy || order.createdBy?.fullName || order.createdBy?.email || '—';
  const role = company.issuedByRole || order.createdBy?.role;
  const location = typeof customer.lat === 'number' && typeof customer.lng === 'number'
    && Number.isFinite(customer.lat) && Number.isFinite(customer.lng);
  const subtotal = order.subtotalAmount ?? rows.reduce((sum, row) =>
    sum + Math.round(Number(row.total) * 100), 0) / 100;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"
        alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>
            {t('Sales invoice')}
          </Typography>
          <Typography component="h2" sx={{ fontSize: 24, fontWeight: 700,
            letterSpacing: '-0.6px', overflowWrap: 'anywhere' }}>
            #{invoiceNumber}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {formatDate(order.createdAt)}
          </Typography>
          {hasBalance && <Chip size="small" label={t(status)} color={statusColor}
            sx={{ fontWeight: 600, borderRadius: '6px', fontSize: 11 }} />}
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' },
        gap: 2, mb: 2 }}>
        <Box sx={{ ...cardSx, p: 2.5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: '#edf2ff', color: '#3155d9' }}>
              <PersonOutlineRoundedIcon fontSize="small" />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('Customer')}</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>
                {customer.name || '—'}
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Field label={t('Telefon')}>
              {customer.phone && <Link href={'tel:' + customer.phone} underline="hover"
                color="inherit">{customer.phone}</Link>}
            </Field>
            <Field label={t('Salon / store')}>{customer.salon}</Field>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Field label={t('Ünvan')}>{customer.address || customer.area?.name}</Field>
            </Box>
          </Box>
          {location && <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
            <Link href={googleMapsLink(customer.lat, customer.lng)} target="_blank"
              rel="noreferrer" underline="hover" sx={{ fontSize: 12,
                display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              Google Maps <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
            </Link>
            <Link href={wazeLink(customer.lat, customer.lng)} target="_blank"
              rel="noreferrer" underline="hover" sx={{ fontSize: 12,
                display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              Waze <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
            </Link>
          </Stack>}
        </Box>

        <Box sx={{ ...cardSx, p: 2.5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: '#f0f3f7', color: '#64748b' }}>
              <ReceiptLongRoundedIcon fontSize="small" />
            </Avatar>
            <Typography component="h3" sx={{ fontSize: 14, fontWeight: 600 }}>
              {t('Əsas məlumatlar')}
            </Typography>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Field label={t('Recorded by')}>{seller}</Field>
            <Field label={t('Rol:')}>{role ? t(role) : '—'}</Field>
            <Field label={t('Ödəniş növü')}>{t(order.paymentType || '—')}</Field>
            <Field label={t('Date')}>{formatDate(order.createdAt)}</Field>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)',
        md: 'minmax(0, 1fr) 280px' }, gap: 2, alignItems: 'start' }}>
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Box sx={cardSx}>
            <Stack direction="row" alignItems="center" justifyContent="space-between"
              sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography component="h3" sx={{ fontSize: 14, fontWeight: 600 }}>
                {t('Products')}
              </Typography>
              <Chip size="small" label={rows.length} sx={{ height: 24, fontSize: 11 }} />
            </Stack>
            <TableContainer tabIndex={0} aria-label={t('Products')}>
              <Table size="small" sx={{ minWidth: 460,
                '& th': { bgcolor: '#fafbfc', color: 'text.secondary', fontSize: 11,
                  fontWeight: 500, whiteSpace: 'nowrap' },
                '& td': { fontSize: 12, verticalAlign: 'top' },
                '& th, & td': { px: 2.5, py: 1.75 },
                '& tr:last-child td': { borderBottom: 0 } }}>
                <TableHead><TableRow>
                  <TableCell>{t('Product')}</TableCell>
                  <TableCell align="right">{t('Quantity')}</TableCell>
                  <TableCell align="right">{t('Unit price')}</TableCell>
                  <TableCell align="right">{t('Total')}</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {rows.length === 0 && <TableRow><TableCell colSpan={4}>
                    {t('Məlumat tapılmadı')}
                  </TableCell></TableRow>}
                  {rows.map((row, index) => <TableRow key={`${row.id}-${index}`}>
                    <TableCell sx={{ minWidth: 150, maxWidth: 260, overflowWrap: 'anywhere' }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{row.name}</Typography>
                      <Typography sx={{ mt: 0.4, fontSize: 11, color: 'text.secondary' }}>
                        {[sourceItems[index]?.categoryName ?? sourceItems[index]?.product?.category?.name,
                          row.sku].filter(Boolean).join(' · ')}
                      </Typography>
                      {row.gift && <Chip label={t('Gift')} size="small" color="secondary"
                        variant="outlined" sx={{ mt: 0.75, height: 21, fontSize: 10 }} />}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatNumber(row.quantity)}
                      <Typography component="div" sx={{ mt: 0.4, fontSize: 10, color: 'text.secondary' }}>
                        {t(row.unit)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{amount(row.unitPrice)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {amount(row.gift ? 0 : row.total)}
                    </TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {order.note && <Box sx={{ ...cardSx, p: 2.5 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>{t('Note')}</Typography>
            <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {order.note}
            </Typography>
          </Box>}
        </Stack>

        <Box sx={{ ...cardSx, p: 2.5 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('Total')}</Typography>
          <Typography sx={{ mt: 0.75, mb: 2.5, fontSize: 28, lineHeight: 1.2,
            fontWeight: 700, letterSpacing: '-0.7px', overflowWrap: 'anywhere' }}>
            {amount(invoiceTotal(order))}
          </Typography>
          <Stack spacing={1.5}>
            <AmountRow label={t('Subtotal')} value={amount(subtotal)} />
            {Number(order.discountAmount) > 0 && <AmountRow label={t('Discount')}
              value={amount(-Number(order.discountAmount))} />}
            {Number(order.taxAmount) > 0 && <AmountRow label={t('Tax')} value={amount(order.taxAmount)} />}
            {Number(order.allocatedReturn) > 0 && <AmountRow label={t('Returns')}
              value={amount(-Number(order.allocatedReturn))} />}
            <Divider />
            <AmountRow label={t('Paid')} value={amount(order.allocatedPayment)} strong />
          </Stack>
          <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px',
            bgcolor: !hasBalance ? '#f4f6f8' : debt > 0 ? '#fff7ed' : '#edf7f1' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{t('Outstanding')}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 700, overflowWrap: 'anywhere',
              color: !hasBalance ? 'text.secondary' : debt > 0 ? '#9a5a13' : '#23734d' }}>
              {amount(order.remainingDebt)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
