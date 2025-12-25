import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import YearSelector from '../components/YearSelector';

const LeaveBalance = () => {
  const { t } = useTranslation();
  const { user, isSystemAdmin, isDeptHead } = useAuth();
  const [balances, setBalances] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalances();
  }, [year]);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/leaves/balances', {
        params: { year, user_id: user.id }
      });
      setBalances(response.data.balances || []);
    } catch (error) {
      console.error('Fetch balances error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1400px', mx: 'auto' }}>
      <Typography 
        variant="h4" 
        gutterBottom
        sx={{ 
          fontSize: { xs: '1.5rem', sm: '2rem' }, 
          mb: 3,
          fontWeight: 600,
          color: 'primary.main'
        }}
      >
        {t('leaveBalance.title')}
      </Typography>

      <Paper 
        elevation={2}
        sx={{ 
          p: { xs: 2, sm: 3 },
          mb: 3,
          borderRadius: 2,
          background: 'linear-gradient(to bottom, #ffffff, #f8f9fa)'
        }}
      >
        <YearSelector
          value={year}
          onChange={(year) => setYear(year)}
          labelKey="leaveBalance.year"
          sx={{ mb: 3, minWidth: 200 }}
        />

        <Paper 
          elevation={1}
          sx={{ 
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ 
                  backgroundColor: 'primary.main',
                  '& .MuiTableCell-head': {
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.95rem'
                  }
                }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveBalance.leaveType')}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('leaveBalance.entitlement')}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('leaveBalance.taken')}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('leaveBalance.balance')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('common.loading')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : balances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('leaveBalance.noBalanceRecords')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  balances.map((balance, index) => (
                    <TableRow 
                      key={balance.id}
                      sx={{
                        '&:nth-of-type(even)': {
                          backgroundColor: 'action.hover'
                        },
                        '&:hover': {
                          backgroundColor: 'action.selected'
                        },
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {balance.leave_type_name_zh} ({balance.leave_type_code})
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: 'primary.dark' }}>
                        {parseFloat(balance.total).toFixed(1)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {parseFloat(balance.taken).toFixed(1)}
                      </TableCell>
                      <TableCell 
                        align="right"
                        sx={{
                          whiteSpace: 'nowrap',
                          fontWeight: 700,
                          color: parseFloat(balance.balance) < 0 ? 'error.main' : 'success.main'
                        }}
                      >
                        {parseFloat(balance.balance).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Paper>
    </Box>
  );
};

export default LeaveBalance;

