const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const { connectDB } = require('./config/db');

async function startServer() {
  try {
    await connectDB();

    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`VisionAble API listening on port ${port}`);
    });
  } catch {
    console.error('Failed to start VisionAble API. Check Supabase configuration and connectivity.');
    process.exitCode = 1;
  }
}

startServer();
