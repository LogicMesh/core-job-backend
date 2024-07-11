import crypto from 'crypto';

/**
 * Generate acces key for the customer
 */
const generateAccessKey = (jobKey: string, secret: string) => {
  const accessKey = crypto.createHmac('sha256', secret).update(`${jobKey}`).digest('hex');
  return accessKey;
};

export default generateAccessKey;
