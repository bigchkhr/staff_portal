import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Card,
  CardContent,
  Grid,
  Divider,
  useTheme,
  useMediaQuery,
  Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { Search as SearchIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import YearSelector from '../components/YearSelector';
import UserSearchDialog from '../components/UserSearchDialog';

const AdminBalances = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [users, setUsers] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [open, setOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    leave_type_id: '',
    amount: '',
    year: new Date().getFullYear(),
    start_date: null,
    end_date: null,
    remarks: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchLeaveTypes();
  }, []);

  // 當選擇的用戶改變時，更新 selectedUserId
  useEffect(() => {
    if (selectedUser) {
      setSelectedUserId(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUserId) {
      fetchBalances();
      fetchTransactions();
    }
  }, [selectedUserId, selectedYear, selectedLeaveTypeId]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      const usersList = response.data.users || [];
      usersList.sort((a, b) => {
        const aNum = a.employee_number || '';
        const bNum = b.employee_number || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      });
      setUsers(usersList);
    } catch (error) {
      console.error('Fetch users error:', error);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/admin/leave-types');
      setLeaveTypes(response.data.leaveTypes || []);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    }
  };

  const fetchBalances = async () => {
    try {
      const response = await axios.get('/api/leaves/balances', {
        params: { user_id: selectedUserId, year: selectedYear }
      });
      setBalances(response.data.balances || []);
    } catch (error) {
      console.error('Fetch balances error:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const params = { user_id: selectedUserId, year: selectedYear };
      if (selectedLeaveTypeId) {
        params.leave_type_id = selectedLeaveTypeId;
      }
      const response = await axios.get('/api/admin/balance-transactions', { params });
      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Fetch transactions error:', error);
    }
  };

  const handleOpen = () => {
    setEditingTransaction(null);
    setFormData({
      user_id: selectedUserId || '',
      leave_type_id: selectedLeaveTypeId || '',
      amount: '',
      year: selectedYear,
      start_date: null,
      end_date: null,
      remarks: ''
    });
    setOpen(true);
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      user_id: transaction.user_id,
      leave_type_id: transaction.leave_type_id,
      amount: transaction.amount.toString(),
      year: transaction.year,
      start_date: transaction.start_date ? dayjs(transaction.start_date) : null,
      end_date: transaction.end_date ? dayjs(transaction.end_date) : null,
      remarks: transaction.remarks || ''
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        ...formData,
        start_date: formData.start_date ? dayjs(formData.start_date).format('YYYY-MM-DD') : null,
        end_date: formData.end_date ? dayjs(formData.end_date).format('YYYY-MM-DD') : null
      };
      
      if (editingTransaction) {
        // 更新現有交易
        await axios.put(`/api/admin/balance-transactions/${editingTransaction.id}`, submitData);
      } else {
        // 創建新交易
        await axios.post('/api/admin/balance-transactions', submitData);
      }
      
      setOpen(false);
      setEditingTransaction(null);
      fetchBalances();
      fetchTransactions();
    } catch (error) {
      alert(error.response?.data?.message || t('adminBalances.operationFailed'));
    }
  };


  // 計算每個假期類型的總計
  const totalsByType = transactions.reduce((acc, transaction) => {
    const key = transaction.leave_type_id || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        leave_type_name_zh: transaction.leave_type_name_zh || '未知',
        leave_type_code: transaction.leave_type_code || '',
        total: 0
      };
    }
    acc[key].total += parseFloat(transaction.amount || 0);
    return acc;
  }, {});

  // 獲取顯示的用戶信息
  const displayUser = selectedUser || users.find(u => u.id === parseInt(selectedUserId));

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
        {t('adminBalances.title')}
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
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2.5, 
          mb: 3,
          alignItems: { xs: 'stretch', sm: 'flex-end' }
        }}>
          <Box sx={{ 
            minWidth: { xs: '100%', sm: 250 }, 
            flex: { xs: '1 1 100%', sm: '1 1 auto' } 
          }}>
            <InputLabel 
              required 
              sx={{ 
                mb: 1.5,
                fontWeight: 500,
                color: 'text.primary'
              }}
            >
              {t('adminBalances.user')}
            </InputLabel>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SearchIcon />}
              onClick={() => setUserDialogOpen(true)}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                height: '56px',
                color: displayUser ? 'text.primary' : 'text.secondary',
                borderColor: displayUser ? 'primary.main' : 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover'
                },
                borderRadius: 1
              }}
            >
              {displayUser 
                ? `${displayUser.employee_number} - ${displayUser.display_name || displayUser.name_zh || '-'}`
                : t('adminPaperFlow.selectApplicant')
              }
            </Button>
          </Box>
          <YearSelector
            value={selectedYear}
            onChange={(year) => setSelectedYear(year)}
            labelKey="adminBalances.year"
            sx={{ 
              minWidth: { xs: '100%', sm: 180 }, 
              flex: { xs: '1 1 100%', sm: '0 0 auto' }
            }}
          />
          <FormControl 
            fullWidth={isMobile} 
            sx={{ 
              minWidth: { xs: '100%', sm: 220 },
              flex: { xs: '1 1 100%', sm: '1 1 auto' }
            }}
          >
            <InputLabel sx={{ fontWeight: 500 }}>{t('adminBalances.leaveTypeOptional')}</InputLabel>
            <Select
              value={selectedLeaveTypeId}
              label={t('adminBalances.leaveTypeOptional')}
              onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
              sx={{ borderRadius: 1 }}
            >
              <MenuItem value="">{t('adminBalances.all')}</MenuItem>
              {leaveTypes.filter(lt => lt.requires_balance).map((lt) => (
                <MenuItem key={lt.id} value={lt.id}>
                  {lt.name_zh} ({lt.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box>
          <Button 
            variant="contained" 
            onClick={handleOpen} 
            disabled={!selectedUserId}
            fullWidth={isMobile}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 1,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4
              },
              '&:disabled': {
                opacity: 0.5
              }
            }}
          >
            {t('adminBalances.addBalance')}
          </Button>
        </Box>
      </Paper>

      {selectedUserId && (
        <>
          <Paper 
            elevation={1}
            sx={{ 
              mb: 3,
              borderRadius: 2,
              borderTop: '3px solid',
              borderColor: 'primary.main'
            }}
          >
            <Tabs 
              value={tabValue} 
              onChange={(e, newValue) => setTabValue(newValue)}
              sx={{
                '& .MuiTab-root': {
                  fontWeight: 500,
                  textTransform: 'none',
                  fontSize: '1rem',
                  minHeight: 64
                },
                '& .Mui-selected': {
                  color: 'primary.main',
                  fontWeight: 600
                }
              }}
            >
              <Tab label={t('adminBalances.balanceOverview')} />
              <Tab label={t('adminBalances.transactionHistory')} />
            </Tabs>
          </Paper>

          {tabValue === 0 && (
            isMobile ? (
              // 手機版：卡片式布局
              <Box>
                {balances.length === 0 ? (
                  <Alert severity="info">{t('adminBalances.noBalanceRecords')}</Alert>
                ) : (
                  balances.map((balance) => (
                    <Card 
                      key={`${balance.leave_type_id}-${balance.year}`} 
                      sx={{ 
                        mb: 2.5,
                        borderRadius: 2,
                        boxShadow: 2,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          boxShadow: 4,
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            mb: 2.5, 
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            color: 'primary.main'
                          }}
                        >
                          {balance.leave_type_name_zh} ({balance.leave_type_code})
                        </Typography>
                        <Grid container spacing={2.5}>
                          <Grid item xs={4}>
                            <Typography 
                              variant="caption" 
                              color="text.secondary" 
                              display="block"
                              sx={{ mb: 0.5, fontWeight: 500 }}
                            >
                              {t('adminBalances.total')}
                            </Typography>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 700,
                                color: 'primary.dark'
                              }}
                            >
                              {parseFloat(balance.total || 0).toFixed(1)}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography 
                              variant="caption" 
                              color="text.secondary" 
                              display="block"
                              sx={{ mb: 0.5, fontWeight: 500 }}
                            >
                              {t('adminBalances.taken')}
                            </Typography>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 600,
                                color: 'text.primary'
                              }}
                            >
                              {parseFloat(balance.taken || 0).toFixed(1)}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography 
                              variant="caption" 
                              color="text.secondary" 
                              display="block"
                              sx={{ mb: 0.5, fontWeight: 500 }}
                            >
                              {t('adminBalances.balance')}
                            </Typography>
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 700,
                                color: parseFloat(balance.balance || 0) < 0 ? 'error.main' : 'success.main'
                              }}
                            >
                              {parseFloat(balance.balance || 0).toFixed(1)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Box>
            ) : (
              // 桌面版：表格布局
              <Paper 
                elevation={2}
                sx={{ 
                  borderRadius: 2,
                  overflow: 'hidden'
                }}
              >
                <TableContainer sx={{ 
                  maxWidth: '100%',
                  overflowX: 'auto',
                  '& .MuiTableCell-root': {
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    padding: { xs: '12px', sm: '16px' },
                    whiteSpace: 'nowrap'
                  }
                }}>
                  <Table size={isTablet ? "small" : "medium"}>
                    <TableHead>
                      <TableRow sx={{ 
                        backgroundColor: 'primary.main',
                        '& .MuiTableCell-head': {
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.95rem'
                        }
                      }}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.leaveType')}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.total')}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.taken')}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.balance')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {balances.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center">{t('adminBalances.noBalanceRecords')}</TableCell>
                        </TableRow>
                      ) : (
                        balances.map((balance, index) => (
                          <TableRow 
                            key={`${balance.leave_type_id}-${balance.year}`}
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
                              {parseFloat(balance.total || 0).toFixed(1)}
                            </TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                              {parseFloat(balance.taken || 0).toFixed(1)}
                            </TableCell>
                            <TableCell 
                              align="right" 
                              sx={{ 
                                whiteSpace: 'nowrap',
                                fontWeight: 700,
                                color: parseFloat(balance.balance || 0) < 0 ? 'error.main' : 'success.main'
                              }}
                            >
                              {parseFloat(balance.balance || 0).toFixed(1)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )
          )}

          {tabValue === 1 && (
            isMobile ? (
              // 手機版：卡片式布局
              <Box>
                {transactions.length === 0 ? (
                  <Alert severity="info">{t('adminBalances.noTransactionRecords')}</Alert>
                ) : (
                  <>
                    {Object.keys(totalsByType).length > 0 && (
                      <Box sx={{ mb: 3 }}>
                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            mb: 2, 
                            fontWeight: 600,
                            color: 'primary.main',
                            fontSize: '1.1rem'
                          }}
                        >
                          {t('adminBalances.leaveTypeTotal')}
                        </Typography>
                        {Object.entries(totalsByType).map(([typeId, typeData]) => (
                          <Card 
                            key={typeId} 
                            sx={{ 
                              mb: 2,
                              borderRadius: 2,
                              boxShadow: 2,
                              background: 'linear-gradient(to right, #f5f5f5, #ffffff)',
                              borderLeft: '4px solid',
                              borderColor: 'primary.main'
                            }}
                          >
                            <CardContent sx={{ py: 2, px: 2.5 }}>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: 600, 
                                  mb: 1,
                                  color: 'text.primary'
                                }}
                              >
                                {typeData.leave_type_name_zh} ({typeData.leave_type_code})
                              </Typography>
                              <Chip
                                label={`${t('adminBalances.totalLabel')} ${typeData.total.toFixed(1)}`}
                                color="primary"
                                size="medium"
                                sx={{ 
                                  fontWeight: 600,
                                  fontSize: '0.95rem',
                                  height: 32
                                }}
                              />
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}
                    <Divider sx={{ my: 3 }} />
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        mb: 2.5, 
                        fontWeight: 600,
                        color: 'primary.main',
                        fontSize: '1.1rem'
                      }}
                    >
                      {t('adminBalances.transactionDetails')}
                    </Typography>
                    {transactions.map((transaction) => (
                      <Card 
                        key={transaction.id} 
                        sx={{ 
                          mb: 2.5,
                          borderRadius: 2,
                          boxShadow: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: 4,
                            transform: 'translateY(-2px)'
                          }
                        }}
                      >
                        <CardContent sx={{ p: 2.5 }}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-start', 
                            mb: 2.5,
                            pb: 2,
                            borderBottom: '2px solid',
                            borderColor: 'divider'
                          }}>
                            <Box>
                              <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                display="block"
                                sx={{ mb: 0.5, fontWeight: 500 }}
                              >
                                {t('adminBalances.date')}
                              </Typography>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: 600,
                                  color: 'text.primary'
                                }}
                              >
                                {new Date(transaction.created_at).toLocaleString('zh-TW')}
                              </Typography>
                            </Box>
                            <Chip
                              label={parseFloat(transaction.amount) > 0 ? `+${transaction.amount}` : transaction.amount}
                              color={parseFloat(transaction.amount) > 0 ? 'success' : 'error'}
                              size="medium"
                              sx={{ 
                                fontWeight: 600,
                                fontSize: '0.95rem',
                                height: 32,
                                boxShadow: 1
                              }}
                            />
                          </Box>

                          <Divider sx={{ my: 1.5 }} />

                          <Grid container spacing={1.5}>
                            <Grid item xs={12}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {t('adminBalances.leaveType')}
                              </Typography>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {transaction.leave_type_name_zh} ({transaction.leave_type_code})
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {t('adminBalances.validPeriod')}
                              </Typography>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {transaction.start_date && transaction.end_date ? (
                                  `${dayjs(transaction.start_date).format('YYYY-MM-DD')} ${t('adminBalances.to')} ${dayjs(transaction.end_date).format('YYYY-MM-DD')}`
                                ) : transaction.start_date ? (
                                  `${t('adminBalances.since')} ${dayjs(transaction.start_date).format('YYYY-MM-DD')}`
                                ) : transaction.end_date ? (
                                  `${t('adminBalances.until')} ${dayjs(transaction.end_date).format('YYYY-MM-DD')}`
                                ) : (
                                  '-'
                                )}
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {t('adminBalances.remarks')}
                              </Typography>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {transaction.remarks || '-'}
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {t('adminBalances.operator')}
                              </Typography>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {transaction.created_by_name || '-'}
                                {transaction.created_by_employee_number && ` (${transaction.created_by_employee_number})`}
                              </Typography>
                            </Grid>
                          </Grid>

                          <Divider sx={{ my: 2 }} />

                          <Button
                            fullWidth
                            variant="outlined"
                            size="medium"
                            startIcon={<EditIcon />}
                            onClick={() => handleEdit(transaction)}
                            sx={{
                              mt: 1,
                              fontWeight: 500,
                              borderRadius: 1,
                              '&:hover': {
                                backgroundColor: 'primary.main',
                                color: 'white',
                                borderColor: 'primary.main'
                              },
                              transition: 'all 0.2s'
                            }}
                          >
                            {t('adminBalances.edit')}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </Box>
            ) : (
              // 桌面版：表格布局
              <>
                {Object.keys(totalsByType).length > 0 && (
                  <Paper 
                    elevation={1}
                    sx={{ 
                      mb: 2,
                      p: 2.5,
                      borderRadius: 2,
                      background: 'linear-gradient(to right, #f5f5f5, #ffffff)',
                      borderLeft: '4px solid',
                      borderColor: 'primary.main'
                    }}
                  >
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        mb: 2, 
                        fontWeight: 600,
                        color: 'primary.main',
                        fontSize: '1.1rem'
                      }}
                    >
                      {t('adminBalances.leaveTypeTotal')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {Object.entries(totalsByType).map(([typeId, typeData]) => (
                        <Box 
                          key={typeId}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            p: 1.5,
                            borderRadius: 1,
                            backgroundColor: 'white',
                            boxShadow: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                            {typeData.leave_type_name_zh} ({typeData.leave_type_code}):
                          </Typography>
                          <Chip
                            label={`${t('adminBalances.totalLabel')} ${typeData.total.toFixed(1)}`}
                            color="primary"
                            size="small"
                            sx={{ 
                              fontWeight: 600,
                              fontSize: '0.875rem'
                            }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                )}
                <Paper 
                  elevation={2}
                  sx={{ 
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}
                >
                  <Box sx={{ p: 2, backgroundColor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 600,
                        color: 'primary.main',
                        fontSize: '1.1rem'
                      }}
                    >
                      {t('adminBalances.transactionDetails')}
                    </Typography>
                  </Box>
                  <TableContainer sx={{ 
                    maxWidth: '100%',
                    overflowX: 'auto',
                    '& .MuiTableCell-root': {
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      padding: { xs: '12px', sm: '16px' },
                      whiteSpace: 'nowrap'
                    }
                  }}>
                    <Table size={isTablet ? "small" : "medium"}>
                      <TableHead>
                        <TableRow sx={{ 
                          backgroundColor: 'primary.main',
                          '& .MuiTableCell-head': {
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.95rem'
                          }
                        }}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.date')}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.leaveType')}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.amount')}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.validPeriod')}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.remarks')}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.operator')}</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{t('adminBalances.actions')}</TableCell>
                        </TableRow>
                      </TableHead>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              {t('adminBalances.noTransactionRecords')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((transaction) => (
                            <TableRow 
                              key={transaction.id}
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
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {new Date(transaction.created_at).toLocaleString('zh-TW')}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
                                {transaction.leave_type_name_zh} ({transaction.leave_type_code})
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                <Chip
                                  label={parseFloat(transaction.amount) > 0 ? `+${transaction.amount}` : transaction.amount}
                                  color={parseFloat(transaction.amount) > 0 ? 'success' : 'error'}
                                  size="small"
                                  sx={{ 
                                    fontWeight: 600,
                                    boxShadow: 1
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                                {transaction.start_date && transaction.end_date ? (
                                  `${dayjs(transaction.start_date).format('YYYY-MM-DD')} ${t('adminBalances.to')} ${dayjs(transaction.end_date).format('YYYY-MM-DD')}`
                                ) : transaction.start_date ? (
                                  `${t('adminBalances.since')} ${dayjs(transaction.start_date).format('YYYY-MM-DD')}`
                                ) : transaction.end_date ? (
                                  `${t('adminBalances.until')} ${dayjs(transaction.end_date).format('YYYY-MM-DD')}`
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                                {transaction.remarks || '-'}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                                {transaction.created_by_name || '-'}
                                {transaction.created_by_employee_number && ` (${transaction.created_by_employee_number})`}
                              </TableCell>
                              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleEdit(transaction)}
                                  color="primary"
                                  sx={{
                                    '&:hover': {
                                      backgroundColor: 'primary.light',
                                      color: 'white'
                                    },
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </>
            )
          )}
        </>
      )}

      <Dialog 
        open={open} 
        onClose={() => {
          setOpen(false);
          setEditingTransaction(null);
        }} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>{editingTransaction ? t('adminBalances.editDialogTitle') : t('adminBalances.addDialogTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl>
              <InputLabel>{t('adminBalances.leaveType')}</InputLabel>
              <Select
                value={formData.leave_type_id}
                label={t('adminBalances.leaveType')}
                onChange={(e) => setFormData(prev => ({ ...prev, leave_type_id: e.target.value }))}
                required
                disabled={!!editingTransaction}
              >
                {leaveTypes.filter(lt => lt.requires_balance).map((lt) => (
                  <MenuItem key={lt.id} value={lt.id}>
                    {lt.name_zh} ({lt.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('adminBalances.amount')}
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              required
              inputProps={{ step: 0.5 }}
              helperText={t('adminBalances.amountHelper')}
            />
            <YearSelector
              value={formData.year}
              onChange={(year) => setFormData(prev => ({ ...prev, year }))}
              labelKey="adminBalances.year"
              required
              disabled={!!editingTransaction}
            />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label={t('adminBalances.validStartDate')}
                value={formData.start_date}
                onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                format="DD/MM/YYYY"
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DatePicker
                label={t('adminBalances.validEndDate')}
                value={formData.end_date}
                onChange={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                format="DD/MM/YYYY"
                slotProps={{ textField: { fullWidth: true } }}
                minDate={formData.start_date}
              />
            </LocalizationProvider>
            <TextField
              label={t('adminBalances.remarks')}
              multiline
              rows={3}
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpen(false);
            setEditingTransaction(null);
          }}>{t('adminBalances.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingTransaction ? t('adminBalances.update') : t('adminBalances.add')}
          </Button>
        </DialogActions>
      </Dialog>

      <UserSearchDialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        onSelect={(user) => setSelectedUser(user)}
        selectedUserId={selectedUserId}
      />
    </Box>
  );
};

export default AdminBalances;
