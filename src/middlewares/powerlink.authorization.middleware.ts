import { Request, Response, NextFunction } from 'express';
import jobService from '@/v1/services/job';
import moment from 'moment';
import { MetaDataSchema } from '@/v1/schemas/job';
import CustomError from '@/utils/Error';
import taskService from '@/v1/services/task';
import logger from '@/config/logger';

const token = process.env.CORE_ACCESS_TOKEN;

const powerlinkAuthorize = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('>>>>>>>>>>>>>>> Starting powerlinkAuthorize Middleware >>>>>>>>>>>>>>>>>>>>>>>>>');

    const task = req.task;

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

    const taskStatus = task.data[0].attributes.status;
    const { id: jobId } = task.data[0].attributes.job.data;
    const { status: jobStatus, validUntil, jobKey } = task.data[0].attributes.job.data.attributes;

    //---------------------------------------------------------------------------------------------
    // Check the Job Status
    if (['NEW', 'STARTED'].includes(jobStatus)) {
      // Check the job validity
      if (validUntil < new Date().toISOString()) {
        logger.info('Job ValidUntil Passed, Mark Job as Expired');
        const jobUpdatedPayload = {
          data: {
            status: 'EXPIRED',
          },
        };

        // Update the job status to expired
        await jobService.updateJobPayload(jobUpdatedPayload, jobId, token as string);

        res.clearCookie(`${jobKey}`);
        // redirect to thank you page
        res.status(302).redirect('/expired');
      }

      //---------------------------------------------------------------------------------------------
      // Check the Task Status
      if (['NEW', 'STARTED'].includes(taskStatus)) {
        if (taskStatus === 'NEW') {
          /**
           * First time start
           * Validate powerlink licenses
           */
          const { license } =
            task.data[0].attributes.application.data.attributes.powerlink.data.attributes;

          // Check if the license expired
          if (license.expiresat < moment().toISOString()) {
            // Check if license model is QUOTA and limit is reached
            if (license.pricing.model === 'QUOTA' && license.limit - license.used <= 0) {
              // Not have enough lisence
              const auditLogData = {
                data: {
                  action: 'Task Error',
                  description: `Insufficient License for powerLink ${task.data.attributes.application.data.attributes.powerlink.data.attributes.name} or Inactive app ${task.data.attributes.application.data.attributes.name}`,
                  job: jobId,
                  metadata,
                },
              };

              // Added audit log entry
              await jobService.createAuditLog(auditLogData, token as string);

              // Redirect to the error page
              return res.status(302).redirect('/error?reason=Insufficient License to Continue');
            }
          } else {
            // Yes enough lisence
            // Proceed to next
            logger.info('Enough Licnese - Can Move to Next');
            logger.info('==================================================');
            return next();
          }
        } else {
          // Status === 'STARTED'
          // Proceed to next
          logger.info('Task Started Already - Move to Next');
          logger.info('==================================================');
          return next();
        }
      } else {
        // Redirect to launchpad
        logger.info(
          'Task Either rejected or Done - Can not submit again - Redirect to Launch pad to move next'
        );
        logger.info('==================================================');
        return taskService.redirectToLaunchpad(res, token as string);
      }
    } else {
      switch (jobStatus) {
        case 'DONE':
          res.clearCookie(`${jobKey}`);
          return res.status(302).json({ message: 'The job is already Done.' }).redirect('/done');

        case 'REJECTED':
          res.clearCookie(`${jobKey}`);
          return res
            .status(302)
            .json({ message: 'The job has been Rejected.' })
            .redirect('/rejected');

        case 'EXPIRED':
          res.clearCookie(`${jobKey}`);
          return res.status(302).json({ message: 'The job has Expired.' }).redirect('/expired');

        case 'CANCELED':
          res.clearCookie(`${jobKey}`);
          return res
            .status(302)
            .json({ message: 'The job has already been Canceled.' })
            .redirect('/canceled');

        default:
          return res.status(302).json({ message: 'Invalid job status' });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};

export default powerlinkAuthorize;
