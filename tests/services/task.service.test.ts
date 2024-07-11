import taskService from '../../src/v1/services/task';
import axios from 'axios';

jest.mock('axios');

describe('TaskService', () => {
  describe('fetchNextAppID', () => {
    it('should return the first task if currentTaskToDoOrder is null or 0', async () => {
      const tasksTodo = [
        { taskOrder: 2, application: { data: { id: 1 } } },
        { taskOrder: 1, application: { data: { id: 2 } } },
      ];

      const result = await taskService.fetchNextAppID({ tasksTodo, currentTaskToDoOrder: null });
      expect(result).toEqual({ taskOrder: 1, application: { data: { id: 2 } } });

      const resultZero = await taskService.fetchNextAppID({ tasksTodo, currentTaskToDoOrder: 0 });
      expect(resultZero).toEqual({ taskOrder: 1, application: { data: { id: 2 } } });
    });

    it('should return null if there are no tasks in the todo list', async () => {
      const tasksTodo = [];

      await expect(
        taskService.fetchNextAppID({ tasksTodo, currentTaskToDoOrder: 0 })
      ).rejects.toThrow("No tasks found in the job's todo list");
    });

    it('should return the next task in the list', async () => {
      const tasksTodo = [
        { taskOrder: 1, application: { data: { id: 1 } } },
        { taskOrder: 2, application: { data: { id: 2 } } },
        { taskOrder: 3, application: { data: { id: 3 } } },
      ];

      const resultFirst = await taskService.fetchNextAppID({ tasksTodo, currentTaskToDoOrder: 1 });
      expect(resultFirst).toEqual({ taskOrder: 2, application: { data: { id: 2 } } });

      const resultSecond = await taskService.fetchNextAppID({ tasksTodo, currentTaskToDoOrder: 2 });
      expect(resultSecond).toEqual({ taskOrder: 3, application: { data: { id: 3 } } });
    });

    it('should return null if currentTaskToDoOrder is the last task', async () => {
      const tasksTodo = [
        { taskOrder: 1, application: { data: { id: 2 } } },
        { taskOrder: 2, application: { data: { id: 1 } } },
      ];

      const result = await taskService.fetchNextAppID({ tasksTodo, currentTaskToDoOrder: 2 });
      expect(result).toBeNull();
    });

    it('should handle tasks with missing application data gracefully', async () => {
      const tasksTodo = [{ taskOrder: 1, application: { data: { id: 2 } } }, { taskOrder: 2 }];

      const result = await taskService.fetchNextAppID({ tasksTodo, currentTaskToDoOrder: 1 });
      expect(result).toEqual({ taskOrder: 2 });
    });

    it('should handle sorting and finding the next task correctly', async () => {
      const tasksTodo = [
        { taskOrder: 3, application: { data: { id: 3 } } },
        { taskOrder: 1, application: { data: { id: 1 } } },
        { taskOrder: 2, application: { data: { id: 2 } } },
      ];

      const result = await taskService.fetchNextAppID({ tasksTodo, currentTaskToDoOrder: 2 });
      expect(result).toEqual({ taskOrder: 3, application: { data: { id: 3 } } });
    });
  });

  describe('getAppConfiguration', () => {
    const token = 'test-token';
    const appID = 55;
    const powerLinkID = 75;

    it('should fetch and combine application keys and powerlink keys correctly', async () => {
      const mockAppKeysResponse = {
        data: {
          data: [
            {
              id: 210,
              attributes: {
                value: 'App Key 1 Value',
                key: {
                  data: {
                    id: 1,
                    attributes: {
                      name: 'App Key 1',
                      type: 'TEXT',
                      description: 'App Key 1 Description',
                      defaultValue: 'App Key 1 Default',
                    },
                  },
                },
              },
            },
          ],
        },
      };

      const mockPowerLinkKeysResponse = {
        data: {
          data: [
            {
              id: 2,
              attributes: {
                name: 'PowerLink Key 2',
                type: 'TEXT',
                possibleValues: '1,2',
                description: 'PowerLink Key 2 Description',
                defaultValue: 'PowerLink Key 2 Default',
              },
            },
          ],
        },
      };

      (axios.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('application-keys')) {
          return Promise.resolve(mockAppKeysResponse);
        }
        if (url.includes('keys')) {
          return Promise.resolve(mockPowerLinkKeysResponse);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await taskService.getAppConfiguration(token, appID, powerLinkID);

      expect(result).toEqual([
        {
          key: 'App Key 1',
          value: 'App Key 1 Value',
          type: 'TEXT',
          description: 'App Key 1 Description',
        },
        {
          key: 'PowerLink Key 2',
          value: 'PowerLink Key 2 Default',
          type: 'TEXT',
          description: 'PowerLink Key 2 Description',
        },
      ]);
    });

    it('should handle errors and log them', async () => {
      const error = new Error('Test error');
      (axios.get as jest.Mock).mockRejectedValue(error);

      await expect(taskService.getAppConfiguration(token, appID, powerLinkID)).rejects.toThrow(
        'Test error'
      );
    });
  });
});
