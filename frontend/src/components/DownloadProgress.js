import React from 'react';
import { LinearProgress, Box, Typography } from '@mui/material';

const DownloadProgress = ({ progress }) => {
  return (
    <Box sx={{ 
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '300px',
      bgcolor: 'background.paper',
      boxShadow: 24,
      p: 4,
      borderRadius: 2,
      zIndex: 1000,
    }}>
      <Typography variant="h6" align="center" gutterBottom>
        Downloading... {Math.round(progress)}%
      </Typography>
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{
          height: 10,
          borderRadius: 5,
          '& .MuiLinearProgress-bar': {
            backgroundColor: '#FFA500'
          }
        }}
      />
    </Box>
  );
};

export default DownloadProgress; 