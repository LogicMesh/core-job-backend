import winston from 'winston';
import 'winston-daily-rotate-file';
import { consoleTransport, elasticSearchTransport } from '@/utils/loggerTransports';

const logger = winston.createLogger({
  level: 'debug', // The minimum level to log
  transports: [elasticSearchTransport, consoleTransport]
});


export default logger;
