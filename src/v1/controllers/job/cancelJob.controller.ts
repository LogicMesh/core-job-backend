import { Request, Response, NextFunction } from 'express';
import jobService from '@/v1/services/job';
import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import { MetaDataSchema } from '@/v1/schemas/job';

const cancelJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('>>>>>>>>>>>>>>> cancelJob >>>>>>>>>>>>>>>>>>>>>>>>>');
    const token = req.headers['authorization'];
    const user = req.user;
    const { jobId } = req.params;

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

    const job = await jobService.getJobById(jobId, token as string);

    // Check the Job is valid
    if (!job) {
      logger.error('Job not found!');
      const error = CustomError.notFound({
        message: 'Job not found!',
        errors: 'Please check the job ID and try again later',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    const { status } = job.data.attributes;
    const metadata = parsedBody.data?.metadata ?? null;

    if (['NEW', 'STARTED'].includes(status)) {
      await jobService.cancelJob(job, user, metadata, token as string);
    } else {
      switch (status) {
        case 'DONE':
          return res
            .status(400)
            .json({ message: 'Cancellation failed: The job is already marked as completed.' });
        case 'REJECTED':
          return res.status(400).json({
            message: 'Cancellation failed: The job has been rejected and can not be canceled.',
          });
        case 'EXPIRED':
          return res.status(400).json({
            message:
              'Cancellation failed: The job has expired and is no longer eligible for cancellation.',
          });
        case 'CANCELED':
          return res.status(400).json({
            message: 'Cancellation failed: The job has already been canceled.',
          });
        default:
          return res.status(400).json({ message: 'Invalid job status' });
      }
    }

    res.status(200).json({ message: 'Job cancelled successfully' });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

export default cancelJob;
