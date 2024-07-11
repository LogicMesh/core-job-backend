import { Request, Response, NextFunction } from 'express';
import jobService from '@/v1/services/job';
import logger from '@/config/logger';
import { JobCreateSchema } from '@/v1/schemas/job';
import CustomError from '@/utils/Error';
import notificationService from '@/v1/services/notification';

const createJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['authorization'];
    const user = req.user;
    const workflowData = req.workflowData;

    // Validate request body
    const parsedBody = JobCreateSchema.safeParse(req.body.data);
    if (!parsedBody.success) {
      const error = CustomError.badRequest({
        message: 'Invalid request body',
        errors: parsedBody.error.errors,
        hints: 'Please check the request body and try again later',
      });
      return res.status(error.status).json(error);
    }

    // Create the job
    const createdJob = await jobService.createJob(
      parsedBody.data,
      workflowData,
      user,
      token as string
    );

    // Construct the URLs and send notifications to the customer
    const { jobKey, customerAccessURL, notificationStatus, loginCodeNotificationStatus } =
      await notificationService.constructURLsAndSendNotifications(
        parsedBody.data,
        workflowData,
        user,
        createdJob,
        token as string
      );

    //Update Job.notificationStatus and job.loginCodeNotificationStatus
    await jobService.updateJobNotificationStatus(
        createdJob.data.id,
        notificationStatus,
        loginCodeNotificationStatus,
        token as string
      );

    // Generate response
    const response = {
      jobKey,
      accessPINCode: createdJob.data.attributes.loginCode,
      customerAccessURL,
      notificationStatus,
      loginCodeNotificationStatus
    };

    res.status(201).json({ message: 'Job created successfully', response });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

export default createJob;
