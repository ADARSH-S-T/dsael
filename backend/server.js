import app from './src/app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`  LabFlow Smart Laboratory Test Management System - Backend API `);
  console.log(`  REST API listening on: http://127.0.0.1:${PORT}`);
  console.log(`  Healthcheck endpoint:  http://127.0.0.1:${PORT}/api/health`);
  console.log('================================================================');
});
