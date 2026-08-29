import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Tabs,
  Tab,
  Grid,
  useTheme,
  useMediaQuery,
  CircularProgress
} from '@mui/material';
import {
  RestartAlt as RestartAltIcon,
  PictureAsPdf as PictureAsPdfIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const CURRENCIES = {
  HKD: {
    code: 'HKD',
    notes: [1000, 500, 100, 50, 20, 10],
    coins: [10, 5, 2, 1, 0.5, 0.2, 0.1]
  },
  CNY: {
    code: 'CNY',
    notes: [100, 50, 20, 10, 5, 1],
    coins: [1, 0.5, 0.1]
  }
};

const PAYMENT_METHODS = ['visa', 'master', 'unionpay', 'alipay', 'wechatpay', 'payme', 'octopus'];

const toCents = (value) => Math.round(Number(value) * 100);

const emptyCounts = () => ({
  HKD: {
    notes: Object.fromEntries(CURRENCIES.HKD.notes.map((d) => [String(d), 0])),
    coins: Object.fromEntries(CURRENCIES.HKD.coins.map((d) => [String(d), 0]))
  },
  CNY: {
    notes: Object.fromEntries(CURRENCIES.CNY.notes.map((d) => [String(d), 0])),
    coins: Object.fromEntries(CURRENCIES.CNY.coins.map((d) => [String(d), 0]))
  }
});

const emptyCoinLumpsum = () => ({ HKD: null, CNY: null });

const emptyPayments = () => ({
  HKD: Object.fromEntries(PAYMENT_METHODS.map((key) => [key, 0])),
  CNY: Object.fromEntries(PAYMENT_METHODS.map((key) => [key, 0]))
});

const formatMoney = (value, currency) =>
  new Intl.NumberFormat(currency === 'CNY' ? 'zh-CN' : 'en-HK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const formatDenom = (value, currency) => {
  const n = Number(value);
  const symbol = currency === 'CNY' ? '¥' : '$';
  if (n >= 1) {
    return `${symbol}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  return `${symbol}${n.toFixed(2)}`;
};

const parseQuantity = (raw) => {
  if (raw === '' || raw == null) return 0;
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

const parseAmount = (raw) => {
  if (raw === '' || raw == null) return 0;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

const qtyFromAmount = (amount, denom) => {
  const denomCents = toCents(denom);
  if (denomCents <= 0) return 0;
  return Math.round(toCents(amount) / denomCents);
};

const amountFromQty = (qty, denom) => (Number(qty) * Number(denom));

const amountInputSx = {
  width: '100%',
  '& .MuiInputBase-input': { py: 0.75 }
};

const dash = (value) => (value && String(value).trim() ? String(value).trim() : '—');

const CashSettlement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const printRef = useRef(null);
  const [currencyTab, setCurrencyTab] = useState('HKD');
  const [counts, setCounts] = useState(emptyCounts);
  const [coinLumpsum, setCoinLumpsum] = useState(emptyCoinLumpsum);
  const [payments, setPayments] = useState(emptyPayments);
  const [draft, setDraft] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [header, setHeader] = useState({
    branchCode: '',
    tillNumber: '',
    handler: ''
  });

  useEffect(() => {
    if (!user) return;
    setHeader((prev) => {
      if (prev.handler) return prev;
      const name = user.display_name || [user.surname, user.given_name].filter(Boolean).join(' ').trim();
      return name ? { ...prev, handler: name } : prev;
    });
  }, [user]);

  const setQty = (currency, kind, denom, qty) => {
    const key = String(denom);
    setCounts((prev) => ({
      ...prev,
      [currency]: {
        ...prev[currency],
        [kind]: {
          ...prev[currency][kind],
          [key]: Math.max(0, qty)
        }
      }
    }));
  };

  const getQty = (currency, kind, denom) =>
    counts[currency][kind][String(denom)] || 0;

  const sectionTotals = useMemo(() => {
    const sumKind = (currency, kind) =>
      CURRENCIES[currency][kind].reduce((sum, denom) => {
        const qty = counts[currency][kind][String(denom)] || 0;
        return {
          qty: sum.qty + qty,
          amount: sum.amount + amountFromQty(qty, denom)
        };
      }, { qty: 0, amount: 0 });

    const build = (currency) => {
      const notes = sumKind(currency, 'notes');
      const coinsCounted = sumKind(currency, 'coins');
      const lumpsum = coinLumpsum[currency];
      const coinsAmount = lumpsum != null ? lumpsum : coinsCounted.amount;
      const paymentTotal = PAYMENT_METHODS.reduce(
        (sum, key) => sum + (payments[currency][key] || 0),
        0
      );
      const cashAmount = notes.amount + coinsAmount;
      return {
        notes,
        coinsCounted,
        coinsAmount,
        coinsLumpsum: lumpsum != null,
        cashAmount,
        paymentTotal,
        totalAmount: cashAmount + paymentTotal
      };
    };

    return {
      HKD: build('HKD'),
      CNY: build('CNY')
    };
  }, [counts, coinLumpsum, payments]);

  const displayQty = (currency, kind, denom) => {
    if (
      draft &&
      draft.type === 'denom' &&
      draft.currency === currency &&
      draft.kind === kind &&
      String(draft.denom) === String(denom) &&
      draft.field === 'qty'
    ) {
      return draft.value;
    }
    const qty = getQty(currency, kind, denom);
    return qty === 0 ? '' : String(qty);
  };

  const displayAmount = (currency, kind, denom) => {
    if (
      draft &&
      draft.type === 'denom' &&
      draft.currency === currency &&
      draft.kind === kind &&
      String(draft.denom) === String(denom) &&
      draft.field === 'amount'
    ) {
      return draft.value;
    }
    const qty = getQty(currency, kind, denom);
    if (qty === 0) return '';
    return amountFromQty(qty, denom).toFixed(2);
  };

  const displayCoinLumpsum = (currency) => {
    if (draft && draft.type === 'coinLumpsum' && draft.currency === currency) {
      return draft.value;
    }
    const amount = sectionTotals[currency].coinsAmount;
    if (!amount) return '';
    return Number(amount).toFixed(2);
  };

  const displayPayment = (currency, method) => {
    if (
      draft &&
      draft.type === 'payment' &&
      draft.currency === currency &&
      draft.method === method
    ) {
      return draft.value;
    }
    const amount = payments[currency][method] || 0;
    if (!amount) return '';
    return Number(amount).toFixed(2);
  };

  const handleQtyChange = (currency, kind, denom, raw) => {
    setDraft({ type: 'denom', currency, kind, denom, field: 'qty', value: raw });
    if (kind === 'coins') {
      setCoinLumpsum((prev) => ({ ...prev, [currency]: null }));
    }
    setQty(currency, kind, denom, parseQuantity(raw));
  };

  const handleAmountChange = (currency, kind, denom, raw) => {
    setDraft({ type: 'denom', currency, kind, denom, field: 'amount', value: raw });
    if (kind === 'coins') {
      setCoinLumpsum((prev) => ({ ...prev, [currency]: null }));
    }
    setQty(currency, kind, denom, qtyFromAmount(parseAmount(raw), denom));
  };

  const handleCoinLumpsumChange = (currency, raw) => {
    setDraft({ type: 'coinLumpsum', currency, value: raw });
    if (raw === '') {
      setCoinLumpsum((prev) => ({ ...prev, [currency]: null }));
      return;
    }
    setCoinLumpsum((prev) => ({ ...prev, [currency]: parseAmount(raw) }));
  };

  const handlePaymentChange = (currency, method, raw) => {
    setDraft({ type: 'payment', currency, method, value: raw });
    setPayments((prev) => ({
      ...prev,
      [currency]: {
        ...prev[currency],
        [method]: parseAmount(raw)
      }
    }));
  };

  const handleBlur = () => setDraft(null);

  const handleReset = () => {
    setDraft(null);
    setCounts(emptyCounts());
    setCoinLumpsum(emptyCoinLumpsum());
    setPayments(emptyPayments());
  };

  const handleExportPdf = async () => {
    if (!printRef.current || exporting) return;

    const currenciesToExport = ['HKD', 'CNY'].filter(
      (code) => toCents(sectionTotals[code].totalAmount) > 0
    );
    if (currenciesToExport.length === 0) {
      Swal.fire({
        icon: 'info',
        title: t('cashSettlement.nothingToExport')
      });
      return;
    }

    setExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      const stamp = dayjs().format('YYYYMMDD-HHmm');
      const branch = String(header.branchCode || 'NA').replace(/[\\/:*?"<>|]/g, '-');
      const till = String(header.tillNumber || 'NA').replace(/[\\/:*?"<>|]/g, '-');
      pdf.save(`transaction-settlement_${branch}_${till}_${stamp}.pdf`);
    } catch (error) {
      console.error('Export PDF error:', error);
      Swal.fire({
        icon: 'error',
        title: t('cashSettlement.exportFailed')
      });
    } finally {
      setExporting(false);
    }
  };

  const renderAmountField = ({ value, onChange, placeholder = '0.00' }) => (
    <TextField
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={handleBlur}
      placeholder={placeholder}
      inputMode="decimal"
      inputProps={{
        min: 0,
        style: { textAlign: 'right' }
      }}
      sx={amountInputSx}
    />
  );

  const renderPrintDenomTable = (currency, kind) => {
    const denoms = CURRENCIES[currency][kind];
    const totals = sectionTotals[currency];
    const isCoins = kind === 'coins';
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: isCoins ? '#dc004e' : '#1976d2', color: '#fff' }}>
            <th colSpan={3} style={{ textAlign: 'left', padding: '8px 10px' }}>
              {t(`cashSettlement.${kind}`)}
            </th>
          </tr>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ textAlign: 'left', padding: '6px 10px', border: '1px solid #ddd' }}>{t('cashSettlement.denomination')}</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', border: '1px solid #ddd' }}>{t('cashSettlement.quantity')}</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', border: '1px solid #ddd' }}>{t('cashSettlement.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {denoms.map((denom) => {
            const qty = getQty(currency, kind, denom);
            const amount = amountFromQty(qty, denom);
            return (
              <tr key={`print-${currency}-${kind}-${denom}`}>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd' }}>{formatDenom(denom, currency)}</td>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{qty || ''}</td>
                <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{amount ? amount.toFixed(2) : ''}</td>
              </tr>
            );
          })}
          <tr style={{ background: '#eeeeee', fontWeight: 700 }}>
            <td style={{ padding: '6px 10px', border: '1px solid #ddd' }}>
              {isCoins ? t('cashSettlement.coinsSubtotal') : t('cashSettlement.notesSubtotal')}
            </td>
            <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
              {isCoins ? (totals.coinsLumpsum ? '' : totals.coinsCounted.qty) : totals.notes.qty}
            </td>
            <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
              {formatMoney(isCoins ? totals.coinsAmount : totals.notes.amount, currency)}
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  const renderSection = (currency, kind) => {
    const denoms = CURRENCIES[currency][kind];
    const isCoins = kind === 'coins';
    const totals = sectionTotals[currency];
    const notesSubtotal = totals.notes;

    return (
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', height: '100%' }}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: isCoins ? 'secondary.main' : 'primary.main',
            color: 'white'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
            {t(`cashSettlement.${kind}`)}
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  backgroundColor: 'action.hover',
                  '& .MuiTableCell-head': { fontWeight: 600 }
                }}
              >
                <TableCell>{t('cashSettlement.denomination')}</TableCell>
                <TableCell align="right" sx={{ width: { xs: 96, sm: 130 } }}>
                  {t('cashSettlement.quantity')}
                </TableCell>
                <TableCell align="right" sx={{ width: { xs: 120, sm: 160 } }}>
                  {t('cashSettlement.amount')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {denoms.map((denom) => (
                <TableRow
                  key={`${currency}-${kind}-${denom}`}
                  sx={{ '&:nth-of-type(even)': { backgroundColor: 'action.hover' } }}
                >
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatDenom(denom, currency)}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.75 }}>
                    <TextField
                      size="small"
                      value={displayQty(currency, kind, denom)}
                      onChange={(e) => handleQtyChange(currency, kind, denom, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={handleBlur}
                      placeholder="0"
                      inputMode="numeric"
                      inputProps={{
                        min: 0,
                        style: { textAlign: 'right' }
                      }}
                      sx={amountInputSx}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.75 }}>
                    {renderAmountField({
                      value: displayAmount(currency, kind, denom),
                      onChange: (raw) => handleAmountChange(currency, kind, denom, raw)
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {isCoins ? (
                <TableRow
                  sx={{
                    bgcolor: 'grey.100',
                    '& .MuiTableCell-root': { fontWeight: 700, borderBottom: 0 }
                  }}
                >
                  <TableCell>{t('cashSettlement.coinsSubtotal')}</TableCell>
                  <TableCell align="right">
                    {totals.coinsLumpsum ? '' : totals.coinsCounted.qty}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.75 }}>
                    {renderAmountField({
                      value: displayCoinLumpsum(currency),
                      onChange: (raw) => handleCoinLumpsumChange(currency, raw)
                    })}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow
                  sx={{
                    bgcolor: 'grey.100',
                    '& .MuiTableCell-root': { fontWeight: 700, borderBottom: 0 }
                  }}
                >
                  <TableCell>{t('cashSettlement.notesSubtotal')}</TableCell>
                  <TableCell align="right">{notesSubtotal.qty}</TableCell>
                  <TableCell align="right">{formatMoney(notesSubtotal.amount, currency)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  const active = sectionTotals[currencyTab];
  const exportedAt = dayjs().format('YYYY-MM-DD HH:mm');

  return (
    <Layout>
      <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1200px', mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            mb: 2
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" sx={{ color: 'primary.main', fontWeight: 600 }}>
              {t('cashSettlement.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('cashSettlement.pageDescription')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
            <Button
              variant="contained"
              startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={handleExportPdf}
              disabled={exporting}
            >
              {t('cashSettlement.exportPdf')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={handleReset}
            >
              {t('common.reset')}
            </Button>
          </Box>
        </Box>

        <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label={t('cashSettlement.branchCode')}
                value={header.branchCode}
                onChange={(e) => setHeader((prev) => ({ ...prev, branchCode: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label={t('cashSettlement.tillNumber')}
                value={header.tillNumber}
                onChange={(e) => setHeader((prev) => ({ ...prev, tillNumber: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label={t('cashSettlement.handler')}
                value={header.handler}
                onChange={(e) => setHeader((prev) => ({ ...prev, handler: e.target.value }))}
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper elevation={1} sx={{ borderRadius: 2, mb: 2 }}>
          <Tabs
            value={currencyTab}
            onChange={(_, value) => setCurrencyTab(value)}
            variant={isMobile ? 'fullWidth' : 'standard'}
          >
            <Tab value="HKD" label={t('cashSettlement.hkd')} />
            <Tab value="CNY" label={t('cashSettlement.cny')} />
          </Tabs>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {renderSection(currencyTab, 'notes')}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderSection(currencyTab, 'coins')}
          </Grid>
        </Grid>

        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mt: 2 }}>
          <TableContainer>
            <Table size="small">
              <TableBody>
                <TableRow
                  sx={{
                    bgcolor: 'grey.100',
                    '& .MuiTableCell-root': { fontWeight: 700, borderBottom: 0 }
                  }}
                >
                  <TableCell>{t('cashSettlement.cashSubtotal')}</TableCell>
                  <TableCell align="right" sx={{ width: { xs: 140, sm: 220 } }}>
                    {formatMoney(active.cashAmount, currencyTab)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mt: 2 }}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.800', color: 'white' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
              {t('cashSettlement.otherPayments')}
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    backgroundColor: 'action.hover',
                    '& .MuiTableCell-head': { fontWeight: 600 }
                  }}
                >
                  <TableCell>{t('cashSettlement.paymentMethod')}</TableCell>
                  <TableCell align="right" sx={{ width: { xs: 140, sm: 200 } }}>
                    {t('cashSettlement.amount')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {PAYMENT_METHODS.map((method) => (
                  <TableRow
                    key={method}
                    sx={{ '&:nth-of-type(even)': { backgroundColor: 'action.hover' } }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>
                      {t(`cashSettlement.payments.${method}`)}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.75 }}>
                      {renderAmountField({
                        value: displayPayment(currencyTab, method),
                        onChange: (raw) => handlePaymentChange(currencyTab, method, raw)
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow
                  sx={{
                    bgcolor: 'grey.100',
                    '& .MuiTableCell-root': { fontWeight: 700, borderBottom: 0 }
                  }}
                >
                  <TableCell>{t('cashSettlement.paymentsSubtotal')}</TableCell>
                  <TableCell align="right">{formatMoney(active.paymentTotal, currencyTab)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper
          elevation={3}
          sx={{
            mt: 2,
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('cashSettlement.grandTotal')}
          </Typography>
          <Typography variant={isMobile ? 'h5' : 'h4'} sx={{ fontWeight: 700 }}>
            {formatMoney(active.totalAmount, currencyTab)}
          </Typography>
        </Paper>

        <Box
          ref={printRef}
          sx={{
            position: 'fixed',
            left: -10000,
            top: 0,
            width: 794,
            bgcolor: '#fff',
            color: '#111',
            p: 3,
            fontFamily: 'Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif'
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('cashSettlement.title')}</div>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>
            {t('cashSettlement.exportedAt')}: {exportedAt}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 18 }}>
            <tbody>
              <tr>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', width: '33%' }}>
                  <div style={{ color: '#666', fontSize: 11 }}>{t('cashSettlement.branchCode')}</div>
                  <div style={{ fontWeight: 700 }}>{dash(header.branchCode)}</div>
                </td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd', width: '33%' }}>
                  <div style={{ color: '#666', fontSize: 11 }}>{t('cashSettlement.tillNumber')}</div>
                  <div style={{ fontWeight: 700 }}>{dash(header.tillNumber)}</div>
                </td>
                <td style={{ padding: '6px 8px', border: '1px solid #ddd' }}>
                  <div style={{ color: '#666', fontSize: 11 }}>{t('cashSettlement.handler')}</div>
                  <div style={{ fontWeight: 700 }}>{dash(header.handler)}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {['HKD', 'CNY']
            .filter((code) => toCents(sectionTotals[code].totalAmount) > 0)
            .map((code) => {
            const totals = sectionTotals[code];
            return (
              <div key={`print-${code}`} style={{ marginBottom: 22, pageBreakInside: 'avoid' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1976d2' }}>
                  {t(`cashSettlement.${code.toLowerCase()}`)}
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>{renderPrintDenomTable(code, 'notes')}</div>
                  <div style={{ flex: 1 }}>{renderPrintDenomTable(code, 'coins')}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
                  <tbody>
                    <tr style={{ background: '#f5f5f5', fontWeight: 700 }}>
                      <td style={{ padding: '6px 10px', border: '1px solid #ddd' }}>{t('cashSettlement.cashSubtotal')}</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'right', width: 160 }}>
                        {formatMoney(totals.cashAmount, code)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#424242', color: '#fff' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>{t('cashSettlement.otherPayments')}</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>{t('cashSettlement.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAYMENT_METHODS.map((method) => (
                      <tr key={`print-${code}-${method}`}>
                        <td style={{ padding: '5px 10px', border: '1px solid #ddd' }}>
                          {t(`cashSettlement.payments.${method}`)}
                        </td>
                        <td style={{ padding: '5px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
                          {(payments[code][method] || 0) ? Number(payments[code][method]).toFixed(2) : ''}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#eeeeee', fontWeight: 700 }}>
                      <td style={{ padding: '6px 10px', border: '1px solid #ddd' }}>{t('cashSettlement.paymentsSubtotal')}</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'right' }}>
                        {formatMoney(totals.paymentTotal, code)}
                      </td>
                    </tr>
                    <tr style={{ background: '#1976d2', color: '#fff', fontWeight: 700 }}>
                      <td style={{ padding: '8px 10px' }}>{t('cashSettlement.grandTotal')}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatMoney(totals.totalAmount, code)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </Box>
      </Box>
    </Layout>
  );
};

export default CashSettlement;
