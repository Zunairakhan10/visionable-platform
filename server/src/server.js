const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');

function startServer() {
  const port = process.env.PORT || 5000;
  return app.listen(port, () => {
    console.log(`VisionAble API listening on port ${port}`);
  });
}

startServer();
