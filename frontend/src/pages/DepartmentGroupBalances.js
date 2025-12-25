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

  const renderMobileCard = (member, balance, index) => {
    return (
      <Card key={`${member.id}-${balance.leave_type_id}-${index}`} sx={{ mb: 2 }}>
        <CardContent>
          {index === 0 && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('departmentGroupBalances.employeeNumber')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {member.employee_number}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('departmentGroupBalances.name')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {member.display_name || member.name_zh || `${member.surname} ${member.given_name}`}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('departmentGroupBalances.department')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {i18n.language === 'en' 
                    ? (member.department_name || member.department_name_zh)
                    : (member.department_name_zh || member.department_name)}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('departmentGroupBalances.position')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {i18n.language === 'en'
                    ? (member.position_name || member.position_name_zh)
                    : (member.position_name_zh || member.position_name)}
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
            </>
          )}
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t('departmentGroupBalances.leaveType')}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              {i18n.language === 'en'
                ? `${balance.leave_type_name || balance.leave_type_name_zh} (${balance.leave_type_code})`
                : `${balance.leave_type_name_zh || balance.leave_type_name} (${balance.leave_type_code})`}
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('departmentGroupBalances.entitlement')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {parseFloat(balance.total).toFixed(1)}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('departmentGroupBalances.taken')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {parseFloat(balance.taken).toFixed(1)}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('departmentGroupBalances.balance')}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold',
                  color: parseFloat(balance.balance) < 0 ? 'error.main' : 'inherit'
                }}
              >
                {parseFloat(balance.balance).toFixed(1)}
              </Typography>
            </Grid>
          </Grid>
          {balance.start_date || balance.end_date ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('departmentGroupBalances.validPeriod')}
              </Typography>
              <Typography variant="body2">
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
                      // 手機版：卡片式布局
                      <Box>
                        {deptGroup.members.map((member) => (
                          <React.Fragment key={member.id}>
                            {member.balances && member.balances.length > 0 ? (
                              member.balances.map((balance, index) => 
                                renderMobileCard(member, balance, index)
                              )
                            ) : (
                              <Card sx={{ mb: 2 }}>
                                <CardContent>
                                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                    {member.employee_number} - {member.display_name || member.name_zh || `${member.surname} ${member.given_name}`}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {t('departmentGroupBalances.noBalanceRecords')}
                                  </Typography>
                                </CardContent>
                              </Card>
                            )}
                          </React.Fragment>
                        ))}
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

