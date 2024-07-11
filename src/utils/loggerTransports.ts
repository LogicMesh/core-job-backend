import { Client } from '@elastic/elasticsearch';
import { format, transports } from 'winston';
import { ElasticsearchTransport, ElasticsearchTransportOptions } from 'winston-elasticsearch';

// Load environment variables with fallback values
const ELASTICSEARCH_ENDPOINT = process.env.ELASTICSEARCH_ENDPOINT || 'http://elasticsearch:9200';
const ELASTICSEARCH_INDEX_PREFIX = process.env.ELASTICSEARCH_INDEX_PREFIX || 'core-backend';

// Elasticsearch client
const client = new Client({ node: ELASTICSEARCH_ENDPOINT });

// get the version from package.json

// const pjson = require('../../package.json');

// Elasticsearch transport options
const elasticsearchOptions: ElasticsearchTransportOptions = {
  level: 'debug', // Capture all log levels,
  client,
  index: 'logs-core-backend', // Index name
  indexPrefix: `logs-${ELASTICSEARCH_INDEX_PREFIX}`,
  indexSuffixPattern: 'YYYY.MM.DD',
  dataStream: true, // Enable data stream support
  ensureIndexTemplate: true, // Ensure the index template is created
  transformer: (logData) => ({
    "@timestamp": new Date().getTime(),
        severity: logData.level,
        stack: logData.meta.stackInfo,
        client_version: logData.meta.req?.headers.app_version || "NOT_DEFINED",
        // service_name: pjson.name,
        // service_version: pjson.version,
        message: `${logData.message}`,
        data: JSON.stringify(logData.meta.data),
  }),
};

// Create Elasticsearch transport
export const elasticSearchTransport = new ElasticsearchTransport(elasticsearchOptions);

// Simple log format with more context
const simpleFormat = format.combine(
  format.timestamp(),
  format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level.toUpperCase()}] ${message}`;
  })
);

// Console transport
export const consoleTransport = new transports.Console({
  level: 'debug',
  format: simpleFormat,
});