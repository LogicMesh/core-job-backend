import crypto from 'crypto';
import generateAccessKey from '../../src/utils/generateAccessKey';

describe('generateAccessKey', () => {
  it('should generate a valid access key', () => {
    const jobKey = 'test_job_key';
    const secret = 'test_secret';

    // Generate access key using the function
    const accessKey = generateAccessKey(jobKey, secret);

    // Manually generate the expected access key using the same algorithm
    const expectedAccessKey = crypto.createHmac('sha256', secret).update(jobKey).digest('hex');

    // Check if the generated access key matches the expected access key
    expect(accessKey).toBe(expectedAccessKey);
  });

  it('should generate different access keys for different job keys', () => {
    const jobKey1 = 'test_job_key1';
    const jobKey2 = 'test_job_key2';
    const secret = 'test_secret';

    // Generate access keys for different job keys
    const accessKey1 = generateAccessKey(jobKey1, secret);
    const accessKey2 = generateAccessKey(jobKey2, secret);

    // Check if the generated access keys are different
    expect(accessKey1).not.toBe(accessKey2);
  });

  it('should generate different access keys for different secrets', () => {
    const jobKey = 'test_job_key';
    const secret_1 = 'test_secret_1';
    const secret_2 = 'test_secret_2';

    // Generate access keys for different secrets
    const accessKey1 = generateAccessKey(jobKey, secret_1);
    const accessKey2 = generateAccessKey(jobKey, secret_2);

    // Check if the generated access keys are different
    expect(accessKey1).not.toBe(accessKey2);
  });

  it('should generate the same access key for the same job key and secret', () => {
    const jobKey = 'test_job_key';
    const secret = 'test_secret';

    // Generate access keys multiple times for the same job key and secret
    const accessKey1 = generateAccessKey(jobKey, secret);
    const accessKey2 = generateAccessKey(jobKey, secret);

    // Check if the generated access keys are the same
    expect(accessKey1).toBe(accessKey2);
  });
});
