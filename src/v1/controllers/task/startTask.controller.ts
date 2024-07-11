import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import { MetaDataSchema } from '@/v1/schemas/job';
import jobService from '@/v1/services/job';
import taskService from '@/v1/services/task';
import { Request, Response, NextFunction } from 'express';
import moment from 'moment';

const token = process.env.CORE_ACCESS_TOKEN;

const startTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('>>>>>>>>>>>>>>> startTask API >>>>>>>>>>>>>>>>>>>>>>>>>');
    const task = req.task;

    const taskId = task.data[0].id;
    const { status, input, config } = task.data[0].attributes;
    const jobId = task.data[0].attributes.job.data.id;

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

    // Extract meta data from parsed body
    const metadata = parsedBody.data?.metadata ?? null;

    // Check the task status
    if (status === 'NEW') {
      /**
       * Update task status to STARTED
       * Update the started moment
       * Update the lisence consumed to true
       */
      const { powerlink } = task.data[0].attributes.application.data.attributes;
      let { license } = powerlink.data.attributes;

      // Check if the license is not expired
      if (license.expiresat > moment().toISOString()) {
        // Check if license model is QUOTA and limit is not reached
        if (license.pricing.model === 'QUOTA' && license.limit - license.used > 0) {
          // Increment powerLink.lisence usage
          license.used += 1;

          const powerlinkUpdatedPayload = {
            data: {
              license,
            },
          };

          logger.info('Update License usage in powerLink');
          // Update the powerlink lisence usage
          await taskService.updatePowerlinkPayload(
            powerlinkUpdatedPayload,
            powerlink.data.id,
            token as string
          );

          logger.info('Update Task to STARTED');
          const taskUpdatedPayload = {
            data: {
              status: 'STARTED',
              startedOn: moment().toISOString(),
            },
          };

          await taskService.updateTaskPayload(taskUpdatedPayload, taskId, token as string);
        }
      }

      // Added audit log entry
      const auditLogData = {
        data: {
          action: 'Task Started',
          description: `Task ID ${task.data[0].id} started`,
          job: jobId,
          metadata,
        },
      };

      await jobService.createAuditLog(auditLogData, token as string);
    }

    // Generate response
    const response = {
      config,
      input,
    };

    res.status(200).json(response);
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

export default startTask;
