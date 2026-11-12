import { useState } from 'react';
import { useAuth } from '../features/auth/useAuth';
import { canUseFeature } from '../features/plans/access';
import SignaturePad from './SignaturePad';
import { api } from '../lib/api';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useMediaQuery } from '@mui/material';
import { useI18n } from '../i18n/useI18n';
import { invoiceLines, invoiceTotal } from '../lib/invoice.mjs';
import '../invoice.css';
export default function InvoiceDialog({
  order: originalOrder,
  onClose
}) {
  const {
      t,
      money,
      date
    } = useI18n(),
    mobile = useMediaQuery('(max-width:600px)'),
    {
      user
    } = useAuth();
  const [updated, setUpdated] = useState(null),
    [error, setError] = useState('');
  const order = updated || originalOrder;
  if (!order) return null;
  const signatures = canUseFeature(user, 'deliverySignatures') && ['ADMIN', 'DRIVER'].includes(user?.role);
  async function sign(kind, signature) {
    try {
      await api.post(`/orders/${order.id}/${kind}`, {
        signature
      });
      setUpdated((await api.get('/orders/' + order.id)).data.order);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || t('Could not save signature.'));
    }
  }
  const company = order.companySnapshot || {},
    customer = order.customerSnapshot || order.customer || {},
    rows = invoiceLines(order),
    currency = order.currency || company.currency || 'USD';
  return <Dialog open fullWidth fullScreen={mobile} maxWidth="md" onClose={onClose} data-invoice-dialog><DialogTitle className="no-print">{t('Print preview')}</DialogTitle><DialogContent dividers className="invoice-dialog-content"><article id="invoice-print" className="invoice-print"><header className="invoice-header"><div>{company.logoUrl && <img className="invoice-logo" src={company.logoUrl} alt={t('Company logo')} />}<h1>{company.name || t('Sales invoice')}</h1>{[company.address, company.phone, company.taxId].filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}</div><div><h2>{t('Sales invoice')}</h2><strong>{order.invoiceNumber || String(order.orderNumber).padStart(5, '0')}</strong><div>{date(order.createdAt, true, company.timezone)}</div></div></header>
 <section className="invoice-parties"><div><h3>{t('Customer')}</h3><strong>{customer.name}</strong>{[customer.salon, customer.phone, customer.address].filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}</div><div><h3>{t('Recorded by')}</h3><strong>{company.issuedBy || order.createdBy?.fullName || '—'}</strong><div>{t('Customer ID')}: {customer.id || order.customerId}</div></div></section>
 <table className="invoice-table"><thead><tr><th>#</th><th>{t('Product')}</th><th>{t('Quantity')}</th><th>{t('Unit price')}</th><th>{t('Total')}</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.id + '-' + i}><td>{i + 1}</td><td><strong>{row.name}</strong>{row.sku && <div className="invoice-muted">{row.sku}</div>}{row.gift && <div className="invoice-muted">{t('Gift')}</div>}</td><td>{row.quantity}</td><td>{money(row.unitPrice, currency)}</td><td>{money(row.total, currency)}</td></tr>)}</tbody></table>
 <section className="invoice-footer"><div>{order.note && <><h3>{t('Note')}</h3><p>{order.note}</p></>}{order.sellerSignature && <img className="invoice-signature" src={order.sellerSignature} alt={t('Sender signature')} />}{order.customerSignature && <img className="invoice-signature" src={order.customerSignature} alt={t('Recipient signature')} />}</div><div className="invoice-totals"><div className="invoice-grand-total"><strong>{t('Total')}</strong><strong>{money(invoiceTotal(order), currency)}</strong></div>{order.allocatedReturn > 0 && <div><span>{t('Returns')}</span><span>{money(order.allocatedReturn, currency)}</span></div>}{order.allocatedPayment != null && <div><span>{t('Paid')}</span><span>{money(order.allocatedPayment, currency)}</span></div>}{order.remainingDebt != null && <div><span>{t('Outstanding')}</span><strong>{money(order.remainingDebt, currency)}</strong></div>}</div></section>
 </article>{signatures && <Box className="no-print" sx={{
        mt: 2,
        p: 2,
        bgcolor: '#fff'
      }}>{error && <Alert severity="error">{error}</Alert>}{user.role === 'ADMIN' && !order.sellerSignature && <><Typography>{t('Sender signature')}</Typography><SignaturePad onSave={value => sign('seller-signature', value)} /></>}{!order.customerSignature && <><Typography>{t('Recipient signature')}</Typography><SignaturePad onSave={value => sign('signature', value)} /></>}</Box>}</DialogContent><DialogActions className="no-print"><Button onClick={onClose}>{t('Close')}</Button><Button variant="contained" onClick={() => window.print()}>{t('Print invoice')}</Button></DialogActions></Dialog>;
}
