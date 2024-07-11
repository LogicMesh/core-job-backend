import axios from 'axios';
import moment from 'moment';
import crypto from 'crypto';
import { STRAPI_URL } from '@/config/config_url';
import logger from '@/config/logger';
import generatePinCode from '@/utils/generatePinCode';
import CustomError from '@/utils/Error';
import notificationService from '../notification';

class JobService {
  /**
   * Get workflow by id
   * @param workflowId - workflow id
   * @param token - authorization token
   * @returns - workflow data or an appropriate error message
   */
  public async getWorkflowById(workflowId: number, token: string) {
    try {
      const response = await axios.get(
        `${STRAPI_URL}/workflows/${workflowId}?populate[0]=tasksToDo.application.powerlink.license.pricing&populate[1]=whatsappNotification&populate[2]=smsNotification&populate[3]=emailNotification&populate[4]=loginCodeWhatsappNotification&populate[5]=loginCodeSMSNotification&populate[6]=loginCodeEmailNotification`,
        {
          headers: {
            Authorization: token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      if (error.response.status === 404) {
        CustomError.notFound({
          message: 'Workflow not found',
          hints: 'Please contact your system administrator',
        });
      }
    }
  }

  //=================================================================================
  /**
   * Extract TasksToDo Data from the tasksToDo array
   * @param tasksToDo - tasksToDo array
   * @returns Array of tasks without id field
   */
  public extractTaskOrderAndApplicationId(tasksToDo: any): any[] {
    if (!tasksToDo) return [];

    return tasksToDo.map((taskToDo: any) => ({
      taskOrder: taskToDo.taskOrder,
      application: taskToDo.application?.data?.id ?? null,
    }));
  }

  //=================================================================================
  /**
   * Create audit log for job creation
   * @param logData - audit log data
   */
  public async createAuditLog(logData: any, token: string) {
    try {
      axios.post(`${STRAPI_URL}/auditlogs`, logData, {
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      logger.error('Error creating audit log', err);
      throw err;
    }
  }

  //=================================================================================
  /**
   * Update Job Notification Status
   * @param JobID - Created job data
   * @param notificationStatus - Connect Message notification status
   * @param loginCodeNotificationStatus - LooginCode Notification Status
   * @param token - strapi Access Token
   */
  public async updateJobNotificationStatus(
    jobID: number,
    notificationStatus: any,
    loginCodeNotificationStatus: any,
    token: string
  ) {
    try {
      logger.info(
        `... Updating Job ${jobID} with Notification Status and loginCode Notification Status`
      );

      if (notificationStatus) {
        const jobUpdatePayload = {
          data: {
            notificationStatus,
          },
        };
        await axios.put(`${STRAPI_URL}/jobs/${jobID}`, jobUpdatePayload, {
          headers: {
            Authorization: token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });
      }

      if (loginCodeNotificationStatus) {
        const jobUpdatePayload = {
          data: {
            loginCodeNotificationStatus,
          },
        };
        await axios.put(`${STRAPI_URL}/jobs/${jobID}`, jobUpdatePayload, {
          headers: {
            Authorization: token,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });
      }
      let auditLogData: any;

      //-------------------------------------------------------------
      // Insert Audit Log for Email notification
      if (notificationStatus && notificationStatus.email) {
        switch (notificationStatus.email) {
          case 'SENT':
            auditLogData = {
              data: {
                action: 'Email Notification SENT Successfully',
                description:
                  'Connect Email Notification Message SENT Successfully with Conneciton URL',
                job: jobID,
                metaData: `${notificationStatus.emailMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          case 'FAILED':
            auditLogData = {
              data: {
                action: 'Email Notification Sending FAILED',
                description: 'Connect Email Notification sending FAILED',
                job: jobID,
                metaData: `${notificationStatus.emailMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          default:
          // Code to execute if expression doesn't match any case
        }
      }

      //-------------------------------------------------------------
      // Insert Audit Log for SMS notification
      if (notificationStatus && notificationStatus.sms) {
        switch (notificationStatus.sms) {
          case 'SENT':
            auditLogData = {
              data: {
                action: 'SMS Notification SENT Successfully',
                description:
                  'Connect SMS Notification Message SENT Successfully with Connection URL',
                job: jobID,
                metaData: `${notificationStatus.smsMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          case 'FAILED':
            auditLogData = {
              data: {
                action: 'SMS Notification Sending FAILED',
                description: 'Connect SMS Notification sending FAILED',
                job: jobID,
                metaData: `${notificationStatus.smsMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          default:
            logger.error('Unknown SMS status:', notificationStatus.sms);
            break;
        }
      }

      //-------------------------------------------------------------
      // Insert Audit Log for WhatsApp notification
      if (notificationStatus && notificationStatus.whatsapp) {
        switch (notificationStatus.whatsapp) {
          case 'SENT':
            auditLogData = {
              data: {
                action: 'WhatsApp Notification SENT Successfully',
                description:
                  'Connect WhatsApp Notification Message SENT Successfully with Connection URL',
                job: jobID,
                metaData: `${notificationStatus.whatsappMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          case 'FAILED':
            auditLogData = {
              data: {
                action: 'WhatsApp Notification Sending FAILED',
                description: 'Connect WhatsApp Notification sending FAILED',
                job: jobID,
                metaData: `${notificationStatus.whatsappMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          default:
            logger.error('Unknown WhatsApp status:', notificationStatus.whatsapp);
            break;
        }
      }

      //-------------------------------------------------------------
      // Insert Audit Log for loginCode Email notification
      if (loginCodeNotificationStatus && loginCodeNotificationStatus.email) {
        switch (loginCodeNotificationStatus.email) {
          case 'SENT':
            auditLogData = {
              data: {
                action: 'Email loginCode Notification SENT Successfully',
                description:
                  'loginCode Email Notification Message SENT Successfully with Connection URL',
                job: jobID,
                metaData: `${loginCodeNotificationStatus.emailMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          case 'FAILED':
            auditLogData = {
              data: {
                action: 'Email loginCode Notification Sending FAILED',
                description: 'loginCode Email Notification sending FAILED',
                job: jobID,
                metaData: `${loginCodeNotificationStatus.emailMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          default:
            logger.error('Unknown email status:', loginCodeNotificationStatus.email);
            break;
        }
      }

      //-------------------------------------------------------------
      // Insert Audit Log for loginCode SMS notification
      if (loginCodeNotificationStatus && loginCodeNotificationStatus.sms) {
        switch (loginCodeNotificationStatus.sms) {
          case 'SENT':
            auditLogData = {
              data: {
                action: 'SMS loginCode Notification SENT Successfully',
                description:
                  'loginCode SMS Notification Message SENT Successfully with Connection URL',
                job: jobID,
                metaData: `${loginCodeNotificationStatus.smsMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          case 'FAILED':
            auditLogData = {
              data: {
                action: 'SMS loginCode Notification Sending FAILED',
                description: 'loginCode SMS Notification sending FAILED',
                job: jobID,
                metaData: `${loginCodeNotificationStatus.smsMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          default:
            logger.error('Unknown SMS status:', loginCodeNotificationStatus.sms);
            break;
        }
      }

      //-------------------------------------------------------------
      // Insert Audit Log for loginCode WhatsApp notification
      if (loginCodeNotificationStatus && loginCodeNotificationStatus.whatsapp) {
        switch (loginCodeNotificationStatus.whatsapp) {
          case 'SENT':
            auditLogData = {
              data: {
                action: 'WhatsApp loginCode Notification SENT Successfully',
                description:
                  'loginCode WhatsApp Notification Message SENT Successfully with Connection URL',
                job: jobID,
                metaData: `${loginCodeNotificationStatus.whatsappMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          case 'FAILED':
            auditLogData = {
              data: {
                action: 'WhatsApp loginCode Notification Sending FAILED',
                description: 'loginCode WhatsApp Notification sending FAILED',
                job: jobID,
                metaData: `${loginCodeNotificationStatus.whatsappMessage}`,
              },
            };
            this.createAuditLog(auditLogData, token);
            break;

          default:
            logger.error('Unknown WhatsApp status:', loginCodeNotificationStatus.whatsapp);
            break;
        }
      }
    } catch (err) {
      logger.error('Error Updating Job with Notification Status', err);
      throw err;
    }
  }

  //=================================================================================
  /**
   * Create a new job
   * @param jobData - job data
   * @param user - user data
   * @returns Created job data
   */
  public async createJob(jobData: any, workflowData: any, user: any, token: string) {
    try {
      const {
        tasksToDo,
        customerLoginType,
        requiresCustomerLogin,
        maxLoginTrials,
        maxLoginTrialsLockTimeout,
        LoggedSessionExpiryTimeout,
      } = workflowData.data.attributes;

      // Extract tasksToDo data to insert into the job
      const extractedTasksTodo = this.extractTaskOrderAndApplicationId(tasksToDo);
      const jobPayload = {
        data: {
          ...jobData,
          validUntil:
            moment().add(jobData.validUntil, 'minutes').toISOString() ||
            process.env.VALID_UNTIL_MINUTES,
          status: 'NEW',
          tasksTodo: extractedTasksTodo,
          currentTaskID: null,
          currentTaskToDoOrder: 0,
          startedOn: null,
          completedOn: null,
          loginCode:
            requiresCustomerLogin && customerLoginType === 'PINCode' ? generatePinCode() : null,
          failedLoginTrials: 0,
          lastSuccessfulLogin: null,
          lastFailedLogin: null,
          customerLoginType,
          requiresCustomerLogin,
          maxLoginTrials,
          maxLoginTrialsLockTimeout,
          LoggedSessionExpiryTimeout,
        },
      };

      // Create job in Strapi
      const response = await axios.post(`${STRAPI_URL}/jobs`, jobPayload, {
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('Strapi Job Post Status:', response.status);

      // Create audit log in Strapi in success
      if (response.status >= 200 && response.status < 300) {
        const auditLogData = {
          data: {
            action: 'Job Created',
            description: `Job ${response.data.data.id} Created by user ${user.username}`,
            job: response.data.data.id,
            metaData: jobData.metadata,
          },
        };

        logger.info('Job Posted Scucessfully to Strapi');
        await this.createAuditLog(auditLogData, token);
      }

      return response.data;
    } catch (err) {
      logger.error('Error creating job', err);
      throw err;
    }
  }

  /**
   * Get job by id
   * @param jobId - job id
   * @param token - authorization token
   */
  public async getJobById(jobId: any, token: string): Promise<any> {
    try {
      const response = await axios.get(`${STRAPI_URL}/jobs/${jobId}`, {
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  //===============================================================================================
  /**
   * Update the job payload
   */
  public async updateJobPayload(jobUpdatedPayload: any, id: any, token: string) {
    await axios.put(`${STRAPI_URL}/jobs/${id}`, jobUpdatedPayload, {
      headers: {
        Authorization: token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Update job status to cancelled
   * @param job - job data
   * @param user - user data
   * @param token - authorization token
   */
  public async cancelJob(job: any, user: any, metaData: any, token: string) {
    try {
      const { id } = job.data;

      const jobUpdatedPayload = {
        data: {
          status: 'CANCELED',
        },
      };

      // Update the job status to canceled
      await this.updateJobPayload(jobUpdatedPayload, id, token);

      const auditLogData = {
        data: {
          action: 'Job Cancelled',
          description: `Job Canceled by User ${user.username}}`,
          job: id,
          metaData,
        },
      };

      logger.info('Job Cancelled Scucessfully to Strapi');

      // Create audit log
      await this.createAuditLog(auditLogData, token);
    } catch (err) {
      throw err;
    }
  }

  /**
   * Validate source url
   * @param sourceUrl - calling source url
   * @param token - authorization toke
   */
  public async validateSourceUrl(sourceUrl: string, token: string) {
    try {
      logger.info('...... validateSourceUrl');

      // Get organization settings to construct the customer access URL
      logger.info('...... before strapi to get organizaiton, source URL: ' + sourceUrl);
      const organizationSettings = await notificationService.getOrganizationSettings(token);
      const { launchPadURL } = organizationSettings.data.attributes;

      if (sourceUrl && sourceUrl.includes(launchPadURL)) {
        logger.info('...... VALID SOURCE URL');
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.log(err)
      logger.error('Error validating source url...');
      throw err;
    }
  }

  /**
   * Get job from Strapi using job key
   */
  public async getJobByJobkey(jobKey: string, token: string) {
    try {
      const response = await axios.get(
        `${STRAPI_URL}/jobs/?filters[jobKey][$eq]=${jobKey}&populate[workflow][populate][loginCodeWhatsappNotification]=*&populate[workflow][populate][loginCodeSMSNotification]=*&populate[workflow][populate][loginCodeEmailNotification]=*&populate[tasksTodo][populate][application][populate][powerlink][populate][license][populate][pricing]=*&populate[input]=*&populate[customer]=*&populate[currentTask][populate][output]=*&populate[tasksTodo][populate][task]=*`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      return response.data;
    } catch (err) {
      logger.error('Error fetching job using job key...');
    }
  }

  /**
   * Verify access key
   */
  public verifyAccessKey(jobKey: string, accessKey: string, secret: string) {
    const hash = crypto.createHmac('sha256', secret).update(`${jobKey}`).digest('hex');

    return hash === accessKey;
  }
}

const jobService = new JobService();
export default jobService;
