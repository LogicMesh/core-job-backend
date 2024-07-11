import { STRAPI_URL } from '@/config/config_url';
import axios from 'axios';
import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import moment from 'moment';
import notificationService from '../notification';

class TaskService {
  /**
   * Get task by id
   * @param currentTaskID - current task id
   * @param token - access token
   */
  public async getTaskById(taskId: number, token: string) {
    try {
      const response = await axios.get(
        `${STRAPI_URL}/tasks/${taskId}?populate[application][populate]=powerlink`,
        {
          headers: {
            Authorization: token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (err) {
      throw err;
    }
  }

  //===============================================================================================
  /**
   * Fetch Next Task AppID from the Job.tasksTodo List
   */
  public async fetchNextAppID({ tasksTodo, currentTaskToDoOrder }) {
    try {
      logger.info('######################################### fetchNextAppID - FINDING NEXT APP');

      if (!tasksTodo || tasksTodo.length === 0) {
        throw new Error("No tasks found in the job's todo list");
      }

      //At least one task exist in the tasksTodo
      logger.info('Sorting taskstodo using the taskOrder');
      const sortedTasksTodo = tasksTodo.sort((a, b) => a.taskOrder - b.taskOrder);

      // If currentTaskToDoOrder is null or zero, fetch the first task
      if (currentTaskToDoOrder == null || currentTaskToDoOrder === 0) {
        logger.info('currentTaskToDoOrder is 0, so returning First task object');
        return sortedTasksTodo[0];
      }

      // Find the index of the current task in the todo list
      const currentIndex = sortedTasksTodo.findIndex(
        (task: any) => task.taskOrder === currentTaskToDoOrder
      );

      // If the current task is not found or it is the last one, mark job status as done
      if (currentIndex === -1 || currentIndex === sortedTasksTodo.length - 1) {
        return null;
      }

      // Fetch the next task after the current one
      return sortedTasksTodo[currentIndex + 1];
    } catch (err) {
      logger.error('Error creating task');
      throw err;
    }
  }

  //===============================================================================================
  /**
   * Run Pre-checks before task creation
   */
  public async runPrechecks(application: any, res: any) {
    // Check the Application is active
    if (!application.data || !application.data.attributes.isActive) {
      logger.error('Application is not active!');
      const error = CustomError.badRequest({
        message: 'Application is not active!',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    const { powerlink } = application.data.attributes;

    // Check the Powerlink is active
    if (!powerlink.data || !powerlink.data.attributes.isActive) {
      logger.error('powerLink is not active!');
      const error = CustomError.badRequest({
        message: 'powerLink is not active!',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    const { license } = powerlink.data.attributes;

    // Check the license is available in the powerlink
    if (!license || !license.expiresat) {
      logger.error('Powerlink has no available licenses!');
      const error = CustomError.badRequest({
        message: 'No License found for the requested powerLink!',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    // Check the license expired
    if (license.expiresat < moment().toISOString()) {
      logger.error('License expired for the requested powerLink!');
      const error = CustomError.badRequest({
        message: 'License expired for the requested powerLink!',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    // Check if license model is QUOTA and limit is reached
    if (license.pricing.model === 'QUOTA' && license.limit - license.used <= 0) {
      logger.error('No enough quota license for the requested powerLink!');
      const error = CustomError.badRequest({
        message: 'No enough quota license for the requested powerLink!',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    return true;
  }

  /**
   * Get App Configuration
   */
  public async getAppConfiguration(token: string, appID: any, powerLinkID: any) {
    try {
      logger.info(`>>> getAppConfiguration appID: ${appID} - powerLinkID: ${powerLinkID}`);

      // Fetch all application-keys
      const res_app_keys = await axios.get(
        `${STRAPI_URL}/application-keys?filters[application][id][$eq]=${appID}&populate=key`,
        {
          headers: {
            Authorization: token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      const applicationKeys = res_app_keys.data.data;
      //logger.log("application-Keys " + JSON.stringify(applicationKeys, null, 2));

      // Fetch all keys
      const res_powerlink_keys = await axios.get(
        `${STRAPI_URL}/keys?filters[powerlink][id][$eq]=${powerLinkID}`,
        {
          headers: {
            Authorization: token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      const powerLinkKeys = res_powerlink_keys.data.data;
      //logger.log("powerLink Keys " + JSON.stringify(powerLinkKeys, null, 2));

      // Extract key IDs from application keys
      const applicationKeyIds = new Set(
        applicationKeys.map((appKey: any) => appKey.attributes.key.data.id)
      );

      // Filter out keys from the second list that are in the first list
      const remainingKeys = powerLinkKeys.filter((key: any) => !applicationKeyIds.has(key.id));

      // Attach the remaining keys to the first list
      const combinedKeys = [...applicationKeys, ...remainingKeys.map((key: any) => ({ key }))];
      //logger.log("Combined Keys " + JSON.stringify(combinedKeys, null, 2));

      const configObj = combinedKeys.map((item) => {
        const keyAttributes = item.attributes?.key?.data?.attributes || item.key?.attributes;

        return {
          key: keyAttributes?.name || '',
          type: keyAttributes?.type || '',
          description: keyAttributes?.description || '',
          value: (item.attributes?.value ?? keyAttributes?.defaultValue) || '',
        };
      });

      logger.info('<<< configObject: ' + JSON.stringify(configObj, null, 2));

      return configObj;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  //===============================================================================================
  /**
   * Create a new Task
   * @param jobID - job id
   * @param appID - app id
   * @returns Created task data
   */
  public async createTask({ jobID, appID, input, config, token }) {
    try {
      const taskPayload = {
        data: {
          job: jobID,
          application: appID,
          input,
          config,
        },
      };

      // Create task in Strapi
      const response = await axios.post(`${STRAPI_URL}/tasks`, taskPayload, {
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (err) {}
  }

  /**
   * Get task by task key
   * @param taskKey - current task key
   * @param token - access token
   */
  public async getTaskByTaskKey(taskKey: any, token: string) {
    try {
      const response = await axios.get(
        `${STRAPI_URL}/tasks/?filters[taskKey][$eq]=${taskKey}&populate[0]=application.powerlink.license.pricing&populate[1]=job&populate[2]=input&populate[3]=config`,
        {
          headers: {
            Authorization: token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (err) {
      logger.error('Error fetching task!');
    }
  }

  /**
   * Get powerlink by id
   * @param powerlinkId - powerlink id
   * @param token - access token
   */
  public async getPowerlinkById(powerlinkId: number, token: string) {
    try {
      const response = await axios.get(`${STRAPI_URL}/powerlinks/${powerlinkId}`, {
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (err) {
      logger.error('Error fetching Powerlink!');
    }
  }

  /**
   * Update the task payload
   */
  public async updateTaskPayload(taskUpdatedPayload: any, id: any, token: string) {
    try {
      await axios.put(`${STRAPI_URL}/tasks/${id}`, taskUpdatedPayload, {
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      logger.error('Error Updating Task Payload...');
      logger.error(err);
    }
  }

  /**
   * Update the powerlink payload
   */
  public async updatePowerlinkPayload(powerlinkUpdatedPayload: any, id: any, token: string) {
    try {
      logger.info('>> updatePowerlinkPayload');

      await axios.put(`${STRAPI_URL}/powerlinks/${id}`, powerlinkUpdatedPayload, {
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      logger.error('Error Updating Powerlink Payload...');
      logger.error(err);
    }
  }

  /**
   * Helper function to handle redirection to Launchpad
   */
  public async redirectToLaunchpad(res: any, accessToken: string) {
    try {
      const organizationSettings = await notificationService.getOrganizationSettings(accessToken);
      const { launchPadURL } = organizationSettings.data.attributes;

      // Redirect to LaunchPad to login
      return res.status(302).redirect(`${launchPadURL}`);
    } catch (err) {
      logger.error('Error fetching organization settings:', err);
    }
  }
}

const taskService = new TaskService();
export default taskService;
