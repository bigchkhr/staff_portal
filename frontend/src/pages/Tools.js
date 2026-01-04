import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import FormLibrary from './FormLibrary';
import ExternalLinks from './ExternalLinks';

const Tools = () => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Layout>
      <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1400px', mx: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontSize: { xs: '1.5rem', sm: '2rem' }, 
              fontWeight: 600,
              color: 'primary.main',
              mb: 1
            }}
          >
            {t('tools.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('tools.pageDescription')}
          </Typography>
        </Box>

        <Paper 
          elevation={2}
          sx={{ 
            borderRadius: 2,
            mb: 3
          }}
        >
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '1rem',
                minHeight: 64
              }
            }}
          >
            <Tab label={t('tools.formLibrary')} />
            <Tab label={t('tools.externalLinks')} />
          </Tabs>
        </Paper>

        <Box>
          {tabValue === 0 && <FormLibrary />}
          {tabValue === 1 && <ExternalLinks />}
        </Box>
      </Box>
    </Layout>
  );
};

export default Tools;
