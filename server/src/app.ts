import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requestContext, requestLogger } from './middleware/requestLogger.js';
import apiRouter from './routes/index.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(requestContext());
app.use(requestLogger());

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
