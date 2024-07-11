import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import { RejectTaskSchema } from '@/v1/schemas/task';
import jobService from '@/v1/services/job';
import taskService from '@/v1/services/task';
import { Request, Response, NextFunction } from 'express';
import moment from 'moment';

const token = process.env.CORE_ACCESS_TOKEN;

const rejectTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('>>>>>>>>>>>>>>> rejectTask API >>>>>>>>>>>>>>>>>>>>>>>>>');
    const task = req.task;

    const taskId = task.data[0].id;
    const { status } = task.data[0].attributes;
    const jobId = task.data[0].attributes.job.data.id;

    // Validate the request body
    const parsedBody = RejectTaskSchema.safeParse(req.body.data);
    if (!parsedBody.success) {
      const error = CustomError.badRequest({
        message: 'Invalid request body',
        errors: parsedBody.error.errors,
        hints: 'Please check the request body and try again later',
      });
      return res.status(error.status).json(error);
    }

    // Extract metadata and rejection reason from parsed body
    const metadata = parsedBody.data?.metadata ?? null;
    const rejectionReason = parsedBody.data?.reason ?? null;

    // Check if Task Status is STARTED
    if (status !== 'STARTED') {
      logger.error('Invalid Task Status.');
      const error = CustomError.serverError({
        message: 'Invalid Task Status',
        errors: 'Task can only be rejected if it is in STARTED status',
        hints: 'Please check the task status and try again later',
      });
      return res.status(error.status).json(error);
    }

    logger.info('TASK Status STARTED so can proceed to reject Task');
    /**
     * Mark Task status as REJECTED
     * Update task rejected moment
     * Update the rejected reason
     */
    const taskUpdatedPayload = {
      data: {
        status: 'REJECTED',
        rejectedOn: moment().toISOString(),
        rejectionReason,
      },
    };

    await taskService.updateTaskPayload(taskUpdatedPayload, taskId, token as string);

    logger.info('Task Status Updated to Rejected');

    let auditLogDescription: string = `Task ID ${task.data[0].id} Rejected`;
    if (rejectionReason) {
      auditLogDescription = auditLogDescription + ` With reason: ${rejectionReason}`;
    }
    // Added audit log entry
    const auditLogData = {
      data: {
        action: 'Task Rejected',
        description: auditLogDescription,
        job: jobId,
        metadata,
      },
    };

    await jobService.createAuditLog(auditLogData, token as string);

    logger.info('Audit Log added with rejection reason - Redirect to Launchpad');
    // Redirect to LaunchPad
    return taskService.redirectToLaunchpad(res, token as string);
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

export default rejectTask;
