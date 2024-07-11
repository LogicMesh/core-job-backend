import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import taskService from '@/v1/services/task';

// Augment the Request type to include the 'task' property
declare module 'express-serve-static-core' {
  interface Request {
    task: any;
  }
}

const accessToken = process.env.CORE_ACCESS_TOKEN;

const powerlinkAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(
      '>>>>>>>>>>>>>>> Starting powerlinkAuthenticate Middleware >>>>>>>>>>>>>>>>>>>>>>>>>'
    );

    const { taskKey } = req.params;

    // Fetch Task from strapi using task key
    const task = await taskService.getTaskByTaskKey(taskKey, accessToken as string);

    //--------------------------------------------------------------------------
    // Check the Task exist
    if (task.data.length === 0) {
      logger.error('Task not found.');
      const error = CustomError.notFound({
        message: 'Task not found.',
        errors: 'Please check the task key and try again later',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    // Attach Task Data to the req object
    req.task = task;

    //--------------------------------------------------------------------------
    //Fetch Cookie
    const { jobKey, secret } = task.data[0].attributes.job.data.attributes;
    const launchpadToken = req.cookies[`${jobKey}`];

    //--------------------------------------------------------------------------
    // Check Calling Source
    const callingSourceURL = req.get('Referer') || '';
    const { customerAccessURL } =
      task.data[0].attributes.application.data.attributes.powerlink.data.attributes;

    // Check if the calling source URL is same as the powerlink URL
    if (callingSourceURL.includes(customerAccessURL)) {
      // Valid source
      logger.info('Valid Calling Source. Fetch the Cookie and Check if need Login');
      if (!launchpadToken) {
        logger.error('No Login Cookie exist ... Redirect to launchPad Start');
        return taskService.redirectToLaunchpad(res, accessToken as string);
      }

      try {
        const decoded: any = jwt.verify(launchpadToken, secret);

        // Check the cookie token
        if (decoded && decoded.loggedIn === true && decoded.exp * 1000 >= Date.now()) {
          // Token is valid and user is logged in, proceed to next middleware
          logger.info('Valid Cookie JWT and Cusotmer Loghed in - Move to Next');
          logger.info('==================================================');
          return next();
        } else {
          // Redirect to LaunchPad to login
          logger.info('Invalid Cookie JWT. Must Login again');
          res.clearCookie(`${jobKey}`);
          return taskService.redirectToLaunchpad(res, accessToken as string);
        }
      } catch (err) {
        // Token verification failed
        logger.info('Invalid JWT, Verification Failed. Must Login again');
        res.clearCookie(`${jobKey}`);
        return taskService.redirectToLaunchpad(res, accessToken as string);
      }
    } else {
      // Not allowed calling URL
      const error = CustomError.forbidden({
        message: 'Invalid calling source URL',
        errors: 'Please check the access URL and try again later',
        hints: 'Please contact your system administrator',
      });
      res.clearCookie(`${jobKey}`);
      return res.status(error.status).json(error);
    }
  } catch (err) {
    next(err);
  }
};

export default powerlinkAuthenticate;
