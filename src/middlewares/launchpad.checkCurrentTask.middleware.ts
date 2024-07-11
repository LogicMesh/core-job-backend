import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import { MetaDataSchema } from '@/v1/schemas/job';
import jobService from '@/v1/services/job';
import taskService from '@/v1/services/task';
import { Request, Response, NextFunction } from 'express';
import moment from 'moment';

const launchpadCheckCurrentTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('... Start Middleware launchpadCheckCurrentTask');

    const job = req.jobData;
    if (!job || !job.data[0]) {
      throw CustomError.badRequest({
        message: 'Job data not found',
        hints: 'Ensure job data is available in the request',
      });
    }

    const { jobKey } = job.data[0].attributes;

    const launchpadToken = req.cookies[jobKey];
    console.log('...... Cookie value here: ' + launchpadToken);

    const token = process.env.CORE_ACCESS_TOKEN;
    if (!token) {
      throw CustomError.badRequest({
        message: 'Core access token not found',
        hints: 'Ensure CORE_ACCESS_TOKEN is set in the environment variables',
      });
    }

    // Validate request body
    const parsedBody = MetaDataSchema.safeParse(req.body.data);
    if (!parsedBody.success) {
      const error = CustomError.badRequest({
        message: 'Invalid request body',
        errors: parsedBody.error.errors,
        hints: 'Please check the request body and try again later',
      });
      return res.status(error.status).json(error);
    }

    const metadata = parsedBody.data?.metadata ?? null;
    const { currentTask } = job.data[0].attributes;
    const { id } = job.data[0];

    //logger.log("Job data: " + JSON.stringify(job, null, 2));
    // Check current task id
    if (!currentTask || !currentTask.data) {
      logger.info('######################################### FIRST TASK - GOTO NEXT');
      // No current task ID, proceed to start job
      return next();
    } else {
      logger.info('>>>>>>>>>>>>>>>>>>>>>>>>>>>> CurrentTask Exist');
      const currentTaskID = currentTask.data.id;
      console.log('### CURRENT TASK ID EXIST with ID: ' + currentTaskID);
      // Current task ID exists, fetch current task details
      const task = await taskService.getTaskById(currentTaskID, token as string);
      const { status } = task.data.attributes;

      console.log('### CURRENT TASK STATUS: ' + status);
      switch (status) {
        case 'DONE':
          // Task is done, can proceed to get next task AppID
          logger.info('######################################### CURRENT TASK ID DONE - GOTO NEXT');
          return next();

        case 'NEW':
        case 'STARTED':
          logger.info(
            '######################################### CURRENT TASK ID NEW OR STARTED - REDIRECT TO SAME TASK - GOTO Next'
          );

          const customerAccessURL =
            task?.data?.attributes?.application?.data?.attributes?.powerlink?.data?.attributes
              ?.customerAccessURL ?? null;

          console.log('Task URL ' + customerAccessURL);
          // Task is still in progress, use the same currentTaskID to redirect
          const { LoggedSessionExpiryTimeout } = job.data[0].attributes.workflow.data.attributes;
          console.log('1++++++++++++++ session Expiry timeout: ' + LoggedSessionExpiryTimeout);
          res.cookie(jobKey, launchpadToken, {
            httpOnly: true,
            maxAge: (LoggedSessionExpiryTimeout || 60) * 60 * 1000,
          });

          return res.status(302).redirect(`${customerAccessURL}/${task.data.attributes.taskKey}`);

        case 'REJECTED':
          logger.info(
            '######################################### CURRENT TASK IDREJECTED - REDIRECT /rejected'
          );
          /**
           * Task is rejected, mark job as rejected
           * Update the job status to REJECTED in Strapi
           * Add audit log entry
           */
          try {
            const jobUpdatedPayload = {
              data: {
                status: 'REJECTED',
                rejectedOn: moment().toISOString(),
              },
            };
            await jobService.updateJobPayload(jobUpdatedPayload, id, token as string);

            const auditLogData = {
              data: {
                action: 'Job Rejected',
                description: `Job rejected due to Task ${currentTaskID} of Application ${task.data.attributes.application}`,
                job: id,
                metadata,
              },
            };
            await jobService.createAuditLog(auditLogData, token as string);

            return res.status(302).redirect('/rejected');
          } catch (error) {
            logger.error('Error handling REJECTED status:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
          }

        default:
          throw new Error(`Invalid task status - ${status}`);
      }
    }
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

export default launchpadCheckCurrentTask;
