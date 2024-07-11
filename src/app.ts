import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import YAML from 'yamljs';
import swaggerUI from 'swagger-ui-express';
import logger from '@/config/logger';
import setCorrelationId from '@/middlewares/setCorrelationid.middleware';
import expressWinstonLogger from '@/config/winstonLogger';
import CustomError from '@/utils/Error';
import strapiAuthenticate from '@/middlewares/strapi.auth.middleware';
import jobRoutes from '@/v1/routes/job';
import taskRoutes from '@/v1/routes/task';

const app = express();

app.use([
  express.json(),
  express.urlencoded({ extended: true }),
  cors(),
  cookieParser(),
  setCorrelationId,
  morgan('dev'),
  expressWinstonLogger('info'),
]);

// Swagger OpenAPI Specification 3.0
const swaggerDoc = YAML.load('./swagger.yml');
app.use('/docs/v1', swaggerUI.serve, swaggerUI.setup(swaggerDoc));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  logger.error('🚀 Slinkyy apps is up and running!');
  logger.info('🚀 Slinkyy apps is up and running!');
  console.log('🚀 Slinkyy apps is up and running!');

  res.status(200).json({ message: '🚀 Slinkyy apps is up and running!' });
});

// Test the strapi auth middleware
app.get('/protected/strapi', strapiAuthenticate, (_req: Request, res: Response) => {
  res.status(200).json({ message: '🚀 Protected route' });
});

// Job routes
app.use(jobRoutes);

// Task routes
app.use(taskRoutes);

// Not found handler
app.use((req: Request, res: Response) => {
  const error = CustomError.notFound({
    message: 'Resource Not Found',
    errors: ['The requested resource does not exist'],
    hints: 'Please check the URL and try again',
  });

  res
    .status(error.status)
    .json({ ...error, status: undefined, trace_id: req.headers['x-trace-id'] });
});

// Global error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const errObj = {
    status: err?.status || 500,
    message: err?.message || 'Something went wrong!',
    errors: err?.errors || [],
    correlationId: req.headers['x-correlation-id'],
  };

  logger.error(JSON.stringify(errObj));
  res.status(errObj.status).json(errObj);
});

export default app;
