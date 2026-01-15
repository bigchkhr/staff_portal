import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Link as LinkIcon,
  Contacts as ContactsIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

const Tools = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const toolItems = [
    {
      key: 'myContacts',
      icon: <ContactsIcon sx={{ fontSize: 48 }} />,
      path: '/my-contacts',
      translationKey: 'myContacts'
    },
    {
      key: 'formLibrary',
      icon: <DescriptionIcon sx={{ fontSize: 48 }} />,
      path: '/form-library',
      translationKey: 'formLibrary'
    },
    {
      key: 'externalLinks',
      icon: <LinkIcon sx={{ fontSize: 48 }} />,
      path: '/external-links',
      translationKey: 'externalLinks'
    }
  ];

  const handleItemClick = (path) => {
    navigate(path);
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          {t('tools.title')}
        </Typography>
        <Grid container spacing={3}>
          {toolItems.map((item) => (
            <Grid item xs={6} sm={4} md={3} key={item.key}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardActionArea
                  onClick={() => handleItemClick(item.path)}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3
                  }}
                >
                  <CardContent
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      '&:last-child': {
                        pb: 3
                      }
                    }}
                  >
                    <Box
                      sx={{
                        color: 'primary.main',
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 500 }}>
                      {t(`tools.${item.translationKey}`)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Layout>
  );
};

export default Tools;
