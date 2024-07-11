import { Request, Response, NextFunction } from 'express';
import jobService from '@/v1/services/job';
import logger from '@/config/logger';

const token = process.env.CORE_ACCESS_TOKEN;

const launchpadAuthorize = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = req.jobData;

    logger.info('... Start Middleware launchpadAuthorize');

    const { status, validUntil, jobKey } = job.data[0].attributes;
    const { id } = job?.data[0];
    let redirectPage: any;

    const launchpadToken = req.cookies[jobKey];
    logger.info('jobKey: ' + jobKey);
    logger.info('2.launchpadAuthorize Cookie Value in Request: ' + launchpadToken);
    //----------------------------------------------------------------------------------------------
    //Check Job Status
    logger.info('...... jobStatu: ' + status);
    if (['DONE', 'REJECTED', 'CANCELED', 'EXPIRED'].includes(status)) {
      switch (status) {
        case 'DONE':
          redirectPage = '/done';
          break;
        case 'REJECTED':
          redirectPage = '/rejected';
          break;
        case 'CANCELED':
          redirectPage = '/canceled';
          break;
        case 'EXPIRED':
          redirectPage = '/expired';
          break;
      }

      //redirectPage += `?id=${id}`;
      logger.info('REDIRECT TO: ' + redirectPage);
      return res.status(302).redirect(redirectPage);
    }

    //----------------------------------------------------------------------------------------------
    //Check Valid Until and if expired update as expired
    if (['NEW', 'STARTED'].includes(status)) {
      if (validUntil < new Date().toISOString()) {
        logger.info('...... Job Status is new or started but Time expired, so updated to EXPIRED');
        // Update the job status to expired
        const jobUpdatedPayload = {
          data: {
            status: 'EXPIRED',
          },
        };

        // Update the job status to EXPIRED
        await jobService.updateJobPayload(jobUpdatedPayload, id, token as string);

        redirectPage = `/expired`;
        res.clearCookie(jobKey);
        logger.info('REDIRECT TO: ' + redirectPage);
        return res.status(302).redirect(redirectPage);
      }
    }

    logger.info('===== all Good with Authorize proceed to next ============');
    next();
  } catch (err) {
    next(err);
  }
};

export default launchpadAuthorize;
