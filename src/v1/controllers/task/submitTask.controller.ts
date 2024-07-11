import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import { SubmitTaskSchema } from '@/v1/schemas/task';
import jobService from '@/v1/services/job';
import taskService from '@/v1/services/task';
import { Request, Response, NextFunction } from 'express';
import moment from 'moment';

const token = process.env.CORE_ACCESS_TOKEN;

const submitTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('>>>>>>>>>>>>>>> submitTask API >>>>>>>>>>>>>>>>>>>>>>>>>');

    const task = req.task;

    const taskId = task.data[0].id;
    const { status } = task.data[0].attributes;
    const jobId = task.data[0].attributes.job.data.id;

    // Validate the request body
    const parsedBody = SubmitTaskSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const error = CustomError.badRequest({
        message: 'Invalid request body',
        errors: parsedBody.error.errors,
        hints: 'Please check the request body and try again later',
      });
      return res.status(error.status).json(error);
    }

    // Extract metadata and output from parsed body
    const metadata = parsedBody.data?.data?.metadata ?? null;
    const output = parsedBody.data?.data?.output ?? [];

    console.log(`Metadata from request Body: ${metadata}`);
    logger.info(`Output from Request Body:`);
    console.log(JSON.stringify(output, null, 2));

    // Check if Task Status is STARTED
    if (status !== 'STARTED') {
      logger.error('Invalid Task Status.');
      const error = CustomError.serverError({
        message: 'Invalid Task Status',
        errors: 'Task can only be submitted if it is in STARTED status',
        hints: 'Please check the task status and try again later',
      });
      return res.status(error.status).json(error);
    }

    logger.info(`Task (${taskId}) Status STARTED - Proceed to Submission`);

    /**
     * Mark Task status as DONE
     * Update task completed moment
     * Update the task's output with the submitted data.
     */
    const taskUpdatedPayload = {
      data: {
        status: 'DONE',
        completedOn: moment().toISOString(),
        output,
      },
    };

    await taskService.updateTaskPayload(taskUpdatedPayload, taskId, token as string);

    // Added audit log entry
    const auditLogData = {
      data: {
        action: 'Task Done',
        description: `Task ID ${task.data[0].id} Submitted`,
        job: jobId,
        metadata,
      },
    };

    await jobService.createAuditLog(auditLogData, token as string);

    logger.info('<<<<<<<<<<<<<<< submitTask API - Redirect to LaunchPad <<<<<<<<<<<<<<<<<<<<<<<<<');
    // Redirect to LaunchPad
    return taskService.redirectToLaunchpad(res, token as string);
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

export default submitTask;
