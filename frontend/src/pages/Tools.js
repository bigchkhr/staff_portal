import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import FormLibrary from './FormLibrary';
import ExternalLinks from './ExternalLinks';

const Tools = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Layout>
      <Box sx={{ 
        px: { xs: 1, sm: 2, md: 3 }, 
        py: { xs: 1.5, sm: 2, md: 3 }, 
        maxWidth: '1400px', 
        mx: 'auto',
        width: '100%'
      }}>
        <Box sx={{ mb: { xs: 2, sm: 2.5, md: 3 } }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontSize: { xs: '1.25rem', sm: '1.75rem', md: '2rem' }, 
              fontWeight: 600,
              color: 'primary.main',
              mb: { xs: 0.5, sm: 1 },
              lineHeight: 1.2
            }}
          >
            {t('tools.title')}
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              lineHeight: 1.5
            }}
          >
            {t('tools.pageDescription')}
          </Typography>
        </Box>

        <Paper 
          elevation={2}
          sx={{ 
            borderRadius: { xs: 1, sm: 2 },
            mb: { xs: 2, sm: 2.5, md: 3 },
            overflow: 'hidden'
          }}
        >
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant={isMobile ? "fullWidth" : "standard"}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              minHeight: { xs: 48, sm: 64 },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '1rem' },
                minHeight: { xs: 48, sm: 64 },
                padding: { xs: '12px 8px', sm: '16px 12px', md: '16px 24px' },
                '&.Mui-selected': {
                  fontWeight: 600
                }
              },
              '& .MuiTabs-indicator': {
                height: { xs: 2, sm: 3 }
              }
            }}
            scrollButtons={isMobile ? false : "auto"}
            allowScrollButtonsMobile={false}
          >
            <Tab label={t('tools.formLibrary')} />
            <Tab label={t('tools.externalLinks')} />
          </Tabs>
        </Paper>

        <Box sx={{ 
          width: '100%',
          minHeight: { xs: '400px', sm: '500px' }
        }}>
          {tabValue === 0 && <FormLibrary />}
          {tabValue === 1 && <ExternalLinks />}
        </Box>
      </Box>
    </Layout>
  );
};

export default Tools;
