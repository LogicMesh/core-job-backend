import jobService from '../../src/v1/services/job';
import notificationService from '../../src/v1/services/notification';
import crypto from 'crypto';

jest.mock('../../src/v1/services/notification');

describe('JobService', () => {
  describe('extractTaskOrderAndApplicationId', () => {
    it('should return an empty array if tasksToDo is null or undefined', () => {
      expect(jobService.extractTaskOrderAndApplicationId(null)).toEqual([]);
      expect(jobService.extractTaskOrderAndApplicationId(undefined)).toEqual([]);
    });

    it('should return an array with the correct taskOrder and application id', () => {
      const tasksToDo = [
        {
          taskOrder: 1,
          application: { data: { id: 100 } },
        },
        {
          taskOrder: 2,
          application: { data: { id: 200 } },
        },
      ];

      const expectedOutput = [
        { taskOrder: 1, application: 100 },
        { taskOrder: 2, application: 200 },
      ];

      expect(jobService.extractTaskOrderAndApplicationId(tasksToDo)).toEqual(expectedOutput);
    });

    it('should handle tasks with missing application data gracefully', () => {
      const tasksToDo = [
        {
          taskOrder: 1,
          application: { data: { id: 100 } },
        },
        {
          taskOrder: 2,
          application: { data: null },
        },
      ];

      const expectedOutput = [
        { taskOrder: 1, application: 100 },
        { taskOrder: 2, application: null },
      ];

      expect(jobService.extractTaskOrderAndApplicationId(tasksToDo)).toEqual(expectedOutput);
    });

    it('should handle tasks with missing taskOrder gracefully', () => {
      const tasksToDo = [
        {
          taskOrder: undefined,
          application: { data: { id: 100 } },
        },
        {
          taskOrder: 2,
          application: { data: { id: 200 } },
        },
      ];

      const expectedOutput = [
        { taskOrder: undefined, application: 100 },
        { taskOrder: 2, application: 200 },
      ];

      expect(jobService.extractTaskOrderAndApplicationId(tasksToDo)).toEqual(expectedOutput);
    });

    it('should handle an empty tasksToDo array', () => {
      expect(jobService.extractTaskOrderAndApplicationId([])).toEqual([]);
    });
  });

  describe('verifyAccessKey', () => {
    const secret = 'secretkey';
    const jobKey = 'jobKey';

    it('should return true for a valid access key', () => {
      const accessKey = crypto.createHmac('sha256', secret).update(jobKey).digest('hex');
      expect(jobService.verifyAccessKey(jobKey, accessKey, secret)).toBe(true);
    });

    it('should return false for an invalid access key', () => {
      const invalidAccessKey = 'invalidAccessKey';
      expect(jobService.verifyAccessKey(jobKey, invalidAccessKey, secret)).toBe(false);
    });

    it('should return false for an empty access key', () => {
      expect(jobService.verifyAccessKey(jobKey, '', secret)).toBe(false);
    });

    it('should return false for an incorrect job key', () => {
      const accessKey = crypto.createHmac('sha256', secret).update(jobKey).digest('hex');
      expect(jobService.verifyAccessKey('wrongJobKey', accessKey, secret)).toBe(false);
    });

    it('should return false for an incorrect secret', () => {
      const accessKey = crypto.createHmac('sha256', secret).update(jobKey).digest('hex');
      expect(jobService.verifyAccessKey(jobKey, accessKey, 'wrongsecretkey')).toBe(false);
    });
  });

  describe('validateSourceUrl', () => {
    it('should return true for a valid source URL', async () => {
      const sourceUrl = 'https://launchpad.slinkyy.io/page';
      const launchPadURL = 'https://launchpad.slinkyy.io';

      (notificationService.getOrganizationSettings as jest.Mock).mockResolvedValue({
        data: { attributes: { launchPadURL } },
      });

      const result = await jobService.validateSourceUrl(sourceUrl, 'token');

      expect(notificationService.getOrganizationSettings).toHaveBeenCalledWith('token');
      expect(result).toBe(true);
    });

    it('should return false for an invalid source URL', async () => {
      const sourceUrl = 'https://invalid.example.com/page';
      const launchPadURL = 'https://launchpad.slinkyy.io';

      (notificationService.getOrganizationSettings as jest.Mock).mockResolvedValue({
        data: { attributes: { launchPadURL } },
      });

      const result = await jobService.validateSourceUrl(sourceUrl, 'token');

      expect(notificationService.getOrganizationSettings).toHaveBeenCalledWith('token');
      expect(result).toBe(false);
    });

    it('should throw an error if getting organization settings fails', async () => {
      const sourceUrl = 'https://launchpad.slinkyy.io/page';
      const errorMessage = 'Internal Server Error';

      (notificationService.getOrganizationSettings as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );
      await expect(jobService.validateSourceUrl(sourceUrl, 'token')).rejects.toThrow(errorMessage);

      expect(notificationService.getOrganizationSettings).toHaveBeenCalledWith('token');
    });
  });
});
