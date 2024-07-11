import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import jobService from '@/v1/services/job';

// Augment the Request type to include the 'workflowData' property
declare module 'express-serve-static-core' {
  interface Request {
    jobData: any;
  }
}

const token = process.env.CORE_ACCESS_TOKEN;

const launchpadAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    //----------------------------------------------------------------------------------------------
    // Validate source url
    logger.info('... Validating Source URL');
    const callingSourceURL = req.get('Referer');
    const validURL = await jobService.validateSourceUrl(
      callingSourceURL as string,
      token as string
    );

    if (!validURL) {
      const error = CustomError.forbidden({
        message: 'Invalid calling source URL.',
        errors: 'Please check the source url and try again later',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    const { jobKey, accessKey } = req.params;
    //----------------------------------------------------------------------------------------------
    //Validate Job Key
    logger.info('... Validating jobKey');
    if (!jobKey) {
      const error = CustomError.forbidden({
        message: 'No jobKey provided.',
        errors: 'jobKey required to start Job',
        hints: 'Invalid request to start Job',
      });
      return res.status(error.status).json(error);
    }

    // Fetch job from Strapi using job key
    const job = await jobService.getJobByJobkey(jobKey as string, token as string);

    // Check the Job exist
    if (job.data.length === 0) {
      logger.error('Job not found.');
      const error = CustomError.notFound({
        message: 'Job not found.',
        errors: 'Please check the job key and try again',
        hints: 'Please contact your system administrator',
      });
      res.clearCookie(jobKey);
      return res.status(error.status).json(error);
    }

    // Attach jobData to the req object
    req.jobData = job;

    //----------------------------------------------------------------------------------------------
    // Validate existing JobKey Cookie
    const launchpadToken = req.cookies[`${jobKey}`];
    const { secret } = job.data[0].attributes;
    logger.info('1. launchpadAuthenticate cookie Value here: ' + launchpadToken);

    if (launchpadToken) {
      try {
        // Proceed with the decoded token
        const decodedToken: any = jwt.verify(launchpadToken, secret);
        // Check Cookie Token is expired or invalid signature
        if (decodedToken.exp * 1000 <= Date.now() || !decodedToken) {
          delete req.cookies[jobKey];
        } else {
          logger.info('jobKey from URL: ' + jobKey + ' - jobKey from Token: ' + decodedToken.jobKey);
          // Check job id in the token is same as the requested JobID
          if (decodedToken.jobKey === jobKey) {
            logger.info('>>>>>>>>>>>>>>>>>>> Cookie is valid and can use to proceed to Next');
            //This cookie is correct and valid contiue with it
            return next();
          } else {
            //Clear the cookie and proceed to create new one
            delete req.cookies[jobKey];
          }
        }
      } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
          // Handle the case where the token is not a valid JWT
          logger.error('Invalid JWT token:', error.message);
          logger.info('Clearing Cookin in Request');
          delete req.cookies[jobKey];
          // Respond with an appropriate error message or take necessary action
        }
      }
    } else {
      //No Cookie exist continue as need to generate one
      logger.error('No Cookie Available, Proceed to standard login process');
    }

    //----------------------------------------------------------------------------------------------
    // Verify access key
    if (!accessKey) {
      const error = CustomError.forbidden({
        message:
          'No Valid Cookie and No access key provided. Must login with Access Key to get Valid Cookie',
        errors: 'Access Key required to start Job',
        hints: 'Invalid request to start Job',
      });
      res.clearCookie(jobKey);
      return res.status(error.status).json(error);
    }
    const verifyAccessKey = jobService.verifyAccessKey(jobKey, accessKey, secret);

    if (!verifyAccessKey) {
      logger.error('Access Key is not correct!');
      const error = CustomError.forbidden({
        message: 'Invalid access key.',
        errors:
          'you do not have permission to access this resource. Please check the job key and try again later',
        hints: 'Please contact your system administrator',
      });
      res.clearCookie(jobKey);
      return res.status(error.status).json(error);
    }

    logger.info('===== all Good with Authenticate proceed to next ============');
    next();
  } catch (err) {
    next(err);
  }
};

export default launchpadAuthenticate;
