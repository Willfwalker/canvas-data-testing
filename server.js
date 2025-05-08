const express = require('express');
const corsMiddleware = require('./middleware/cors');
const routes = require('./routes');
const env = require('./config/env');

const app = express();
const PORT = env.PORT;

app.use(corsMiddleware);
app.use(express.json());
app.use(express.static('public'));

app.use(routes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Canvas API URL: ${env.CANVAS_URL}`);
});
