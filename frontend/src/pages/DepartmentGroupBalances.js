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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import YearSelector from '../components/YearSelector';

const DepartmentGroupBalances = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    fetchDepartmentGroupBalances();
  }, [year]);

  const fetchDepartmentGroupBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/leaves/department-group-balances', {
        params: { year }
      });
      setDepartmentGroups(response.data.departmentGroups || []);
      
      // 預設展開第一個群組
      if (response.data.departmentGroups && response.data.departmentGroups.length > 0) {
        setExpandedGroups({ [response.data.departmentGroups[0].id]: true });
      }
    } catch (error) {
      console.error('Fetch department group balances error:', error);
      setError(error.response?.data?.message || t('departmentGroupBalances.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccordionChange = (groupId) => (event, isExpanded) => {
    setExpandedGroups({
      ...expandedGroups,
      [groupId]: isExpanded
    });
  };


  const getRoleChips = (deptGroup) => {
    const chips = [];
    if (deptGroup.checker_id) {
      const checkerName = i18n.language === 'en'
        ? (deptGroup.checker_name || deptGroup.checker_name_zh)
        : (deptGroup.checker_name_zh || deptGroup.checker_name);
      chips.push(
        <Chip 
          key="checker" 
          label={`${t('departmentGroupBalances.checker')}: ${checkerName}`} 
          size="small" 
          color="primary" 
          sx={{ mr: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
        />
      );
    }
    if (deptGroup.approver_1_id) {
      const approver1Name = i18n.language === 'en'
        ? (deptGroup.approver_1_name || deptGroup.approver_1_name_zh)
        : (deptGroup.approver_1_name_zh || deptGroup.approver_1_name);
      chips.push(
        <Chip 
          key="approver1" 
          label={`${t('departmentGroupBalances.approver1')}: ${approver1Name}`} 
          size="small" 
          color="secondary" 
          sx={{ mr: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
        />
      );
    }
    if (deptGroup.approver_2_id) {
      const approver2Name = i18n.language === 'en'
        ? (deptGroup.approver_2_name || deptGroup.approver_2_name_zh)
        : (deptGroup.approver_2_name_zh || deptGroup.approver_2_name);
      chips.push(
        <Chip 
          key="approver2" 
          label={`${t('departmentGroupBalances.approver2')}: ${approver2Name}`} 
          size="small" 
          color="success" 
          sx={{ mr: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
        />
      );
    }
    if (deptGroup.approver_3_id) {
      const approver3Name = i18n.language === 'en'
        ? (deptGroup.approver_3_name || deptGroup.approver_3_name_zh)
        : (deptGroup.approver_3_name_zh || deptGroup.approver_3_name);
      chips.push(
        <Chip 
          key="approver3" 
          label={`${t('departmentGroupBalances.approver3')}: ${approver3Name}`} 
          size="small" 
          color="warning" 
          sx={{ mr: { xs: 0.5, sm: 1 }, mb: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
        />
      );
    }
    return chips;
  };

  const renderMobileMemberCard = (member) => {
    const memberName = member.display_name || member.name_zh || `${member.surname} ${member.given_name}`;
    const departmentName = i18n.language === 'en' 
      ? (member.department_name || member.department_name_zh)
      : (member.department_name_zh || member.department_name);
    const positionName = i18n.language === 'en'
      ? (member.position_name || member.position_name_zh)
      : (member.position_name_zh || member.position_name);

    return (
      <Card 
        key={member.id} 
        sx={{ 
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          boxShadow: 2
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* 成員基本信息 - 突出顯示 */}
          <Box 
            sx={{ 
              mb: 2.5,
              pb: 2,
              borderBottom: '2px solid',
              borderColor: 'primary.main',
              backgroundColor: 'rgba(25, 118, 210, 0.08)',
              borderRadius: 1,
              p: 1.5,
              mx: -1.5,
              mt: -1.5
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: { xs: '1rem', sm: '1.1rem' },
                  color: 'primary.dark'
                }}
              >
                {memberName}
              </Typography>
              <Chip 
                label={member.employee_number}
                size="small"
                color="primary"
                sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                {departmentName} · {positionName}
              </Typography>
            </Box>
          </Box>

          {/* 假期餘額列表 */}
          {member.balances && member.balances.length > 0 ? (
            <Box>
              {member.balances.map((balance, index) => {
                const leaveTypeName = i18n.language === 'en'
                  ? `${balance.leave_type_name || balance.leave_type_name_zh} (${balance.leave_type_code})`
                  : `${balance.leave_type_name_zh || balance.leave_type_name} (${balance.leave_type_code})`;
                const balanceValue = parseFloat(balance.balance);
                const isNegative = balanceValue < 0;

                return (
                  <Box 
                    key={`${balance.leave_type_id}-${index}`}
                    sx={{
                      mb: index < member.balances.length - 1 ? 2.5 : 0,
                      pb: index < member.balances.length - 1 ? 2.5 : 0,
                      borderBottom: index < member.balances.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider'
                    }}
                  >
                    {/* 假期類型標題 */}
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        fontWeight: 'bold',
                        mb: 1.5,
                        color: 'text.primary',
                        fontSize: '0.9rem'
                      }}
                    >
                      {leaveTypeName}
                    </Typography>

                    {/* 餘額信息 - 使用卡片式布局 */}
                    <Grid container spacing={1.5}>
                      <Grid item xs={4}>
                        <Box 
                          sx={{ 
                            textAlign: 'center',
                            p: 1,
                            backgroundColor: 'grey.50',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'grey.200'
                          }}
                        >
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            display="block"
                            sx={{ mb: 0.5, fontSize: '0.7rem' }}
                          >
                            {t('departmentGroupBalances.entitlement')}
                          </Typography>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 'bold',
                              fontSize: '1rem',
                              color: 'text.primary'
                            }}
                          >
                            {parseFloat(balance.total).toFixed(1)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box 
                          sx={{ 
                            textAlign: 'center',
                            p: 1,
                            backgroundColor: 'grey.50',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'grey.200'
                          }}
                        >
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            display="block"
                            sx={{ mb: 0.5, fontSize: '0.7rem' }}
                          >
                            {t('departmentGroupBalances.taken')}
                          </Typography>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 'bold',
                              fontSize: '1rem',
                              color: 'text.primary'
                            }}
                          >
                            {parseFloat(balance.taken).toFixed(1)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box 
                          sx={{ 
                            textAlign: 'center',
                            p: 1,
                            backgroundColor: isNegative ? 'rgba(211, 47, 47, 0.1)' : 'rgba(46, 125, 50, 0.1)',
                            borderRadius: 1,
                            border: '2px solid',
                            borderColor: isNegative ? 'error.main' : 'success.main'
                          }}
                        >
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            display="block"
                            sx={{ mb: 0.5, fontSize: '0.7rem' }}
                          >
                            {t('departmentGroupBalances.balance')}
                          </Typography>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              color: isNegative ? 'error.main' : 'success.dark'
                            }}
                          >
                            {balanceValue.toFixed(1)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* 有效期（如果有） */}
                    {balance.start_date || balance.end_date ? (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography 
                          variant="caption" 
                          color="text.secondary" 
                          display="block"
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {t('departmentGroupBalances.validPeriod')}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          {balance.start_date && balance.end_date ? (
                            `${dayjs(balance.start_date).format('YYYY-MM-DD')} ${t('departmentGroupBalances.to')} ${dayjs(balance.end_date).format('YYYY-MM-DD')}`
                          ) : balance.start_date ? (
                            `${t('departmentGroupBalances.since')} ${dayjs(balance.start_date).format('YYYY-MM-DD')}`
                          ) : balance.end_date ? (
                            `${t('departmentGroupBalances.until')} ${dayjs(balance.end_date).format('YYYY-MM-DD')}`
                          ) : '-'}
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('departmentGroupBalances.noBalanceRecords')}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 2 } }}>
      <Typography 
        variant="h5" 
        gutterBottom
        sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
      >
        {t('departmentGroupBalances.title')}
      </Typography>

      <Paper sx={{ mt: 2, p: { xs: 1.5, sm: 2 } }}>
        <YearSelector
          value={year}
          onChange={(year) => setYear(year)}
          labelKey="departmentGroupBalances.year"
          sx={{ mb: 2, minWidth: { xs: '100%', sm: 200 }, width: { xs: '100%', sm: 'auto' } }}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {departmentGroups.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('departmentGroupBalances.noPermission')}
          </Alert>
        ) : (
          <Box>
            {departmentGroups.map((deptGroup) => (
              <Accordion
                key={deptGroup.id}
                expanded={expandedGroups[deptGroup.id] || false}
                onChange={handleAccordionChange(deptGroup.id)}
                sx={{ mb: 2 }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ 
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' }
                  }}
                >
                  <Box sx={{ 
                    width: '100%', 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between', 
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: { xs: 1, sm: 0 }
                  }}>
                    <Typography 
                      variant="h6"
                      sx={{ 
                        fontSize: { xs: '1rem', sm: '1.25rem' },
                        mb: { xs: 1, sm: 0 }
                      }}
                    >
                      {i18n.language === 'en'
                        ? (deptGroup.name || deptGroup.name_zh)
                        : (deptGroup.name_zh || deptGroup.name)}
                    </Typography>
                    <Box sx={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: { xs: 0.5, sm: 1 }, 
                      ml: { xs: 0, sm: 2 },
                      width: { xs: '100%', sm: 'auto' }
                    }}>
                      {getRoleChips(deptGroup)}
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}>
                  {deptGroup.members && deptGroup.members.length > 0 ? (
                    isMobile ? (
                      // 手機版：卡片式布局 - 每個成員一個卡片，包含所有假期餘額
                      <Box>
                        {deptGroup.members.map((member) => 
                          renderMobileMemberCard(member)
                        )}
                      </Box>
                    ) : (
                      // 桌面版：表格布局（帶橫向滾動）
                      <TableContainer sx={{ 
                        maxWidth: '100%',
                        overflowX: 'auto',
                        '& .MuiTableCell-root': {
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          padding: { xs: '8px', sm: '16px' }
                        }
                      }}>
                        <Table size={isTablet ? "small" : "medium"}>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.employeeNumber')}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.name')}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.department')}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.position')}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.leaveType')}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.entitlement')}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.taken')}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.balance')}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('departmentGroupBalances.validPeriod')}</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {deptGroup.members.map((member) => (
                              <React.Fragment key={member.id}>
                                {member.balances && member.balances.length > 0 ? (
                                  member.balances.map((balance, index) => (
                                    <TableRow key={`${member.id}-${balance.leave_type_id}-${index}`}>
                                      {index === 0 && (
                                        <>
                                          <TableCell rowSpan={member.balances.length} sx={{ whiteSpace: 'nowrap' }}>
                                            {member.employee_number}
                                          </TableCell>
                                          <TableCell rowSpan={member.balances.length} sx={{ whiteSpace: 'nowrap' }}>
                                            {member.display_name || member.name_zh || `${member.surname} ${member.given_name}`}
                                          </TableCell>
                                          <TableCell rowSpan={member.balances.length} sx={{ whiteSpace: 'nowrap' }}>
                                            {i18n.language === 'en' 
                                              ? (member.department_name || member.department_name_zh)
                                              : (member.department_name_zh || member.department_name)}
                                          </TableCell>
                                          <TableCell rowSpan={member.balances.length} sx={{ whiteSpace: 'nowrap' }}>
                                            {i18n.language === 'en'
                                              ? (member.position_name || member.position_name_zh)
                                              : (member.position_name_zh || member.position_name)}
                                          </TableCell>
                                        </>
                                      )}
                                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {i18n.language === 'en'
                                          ? `${balance.leave_type_name || balance.leave_type_name_zh} (${balance.leave_type_code})`
                                          : `${balance.leave_type_name_zh || balance.leave_type_name} (${balance.leave_type_code})`}
                                      </TableCell>
                                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {parseFloat(balance.total).toFixed(1)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {parseFloat(balance.taken).toFixed(1)}
                                      </TableCell>
                                      <TableCell 
                                        align="right"
                                        sx={{
                                          color: parseFloat(balance.balance) < 0 ? 'error.main' : 'inherit',
                                          fontWeight: 'bold',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {parseFloat(balance.balance).toFixed(1)}
                                      </TableCell>
                                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {balance.start_date && balance.end_date ? (
                                          `${dayjs(balance.start_date).format('YYYY-MM-DD')} ${t('departmentGroupBalances.to')} ${dayjs(balance.end_date).format('YYYY-MM-DD')}`
                                        ) : balance.start_date ? (
                                          `${t('departmentGroupBalances.since')} ${dayjs(balance.start_date).format('YYYY-MM-DD')}`
                                        ) : balance.end_date ? (
                                          `${t('departmentGroupBalances.until')} ${dayjs(balance.end_date).format('YYYY-MM-DD')}`
                                        ) : (
                                          '-'
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{member.employee_number}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                      {member.display_name || member.name_zh || `${member.surname} ${member.given_name}`}
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                      {i18n.language === 'en'
                                        ? (member.department_name || member.department_name_zh)
                                        : (member.department_name_zh || member.department_name)}
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                      {i18n.language === 'en'
                                        ? (member.position_name || member.position_name_zh)
                                        : (member.position_name_zh || member.position_name)}
                                    </TableCell>
                                    <TableCell colSpan={5} align="center">
                                      {t('departmentGroupBalances.noBalanceRecords')}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )
                  ) : (
                    <Alert severity="info">
                      {t('departmentGroupBalances.noMembers')}
                    </Alert>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default DepartmentGroupBalances;

