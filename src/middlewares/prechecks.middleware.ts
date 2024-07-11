import { Request, Response, NextFunction } from 'express';
import moment from 'moment';
import { PrecheksMiddlewareSchema } from '@/v1/schemas/job';
import CustomError from '@/utils/Error';
import logger from '@/config/logger';

const prechecks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflowData = req.workflowData;

    // Validate the request body
    const parsedBody = PrecheksMiddlewareSchema.safeParse(req.body.data);
    if (!parsedBody.success) {
      const error = CustomError.badRequest({
        message: 'Invalid request body',
        errors: parsedBody.error.errors,
        hints: 'Please check the request body and try again later',
      });
      return res.status(error.status).json(error);
    }

    const { customer } = parsedBody.data;

    // Check the workflow is valid
    if (!workflowData) {
      logger.error('Workflow not found!');
      const error = CustomError.notFound({
        message: 'Workflow not found!',
        errors: 'Please check the workflow ID and try again later',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    const {
      isActive,
      tasksToDo,
      emailNotification,
      whatsappNotification,
      smsNotification,
      loginCodeEmailNotification,
      loginCodeWhatsappNotification,
      loginCodeSMSNotification,
    } = workflowData.data.attributes;

    logger.info('... Checking Workflow is active');
    // Check workflow is active
    if (!workflowData.data || !isActive) {
      logger.error('Workflow is not active!');
      const error = CustomError.badRequest({
        message: 'Workflow is not active!',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    logger.info('... Checking has tasks to do');
    // Check tasks are defined for the workflow
    if (!tasksToDo || tasksToDo.length === 0) {
      logger.error('Workflow has no tasks!');
      const error = CustomError.badRequest({
        message: 'Workflow has no defined tasks!',
        hints: 'Please contact your system administrator',
      });
      return res.status(error.status).json(error);
    }

    logger.info('... Start Looping in Tasks');
    // Validate the tasks are available for the workflow
    for (const task of tasksToDo) {
      const { application } = task;

      logger.info('...... Checking Application exist');
      // Check the application is exist
      if (!application.data) {
        logger.error('Application does not exist!');
        const error = CustomError.badRequest({
          message: 'Application does not exist!',
          hints: 'Please contact your system administrator',
        });
        return res.status(error.status).json(error);
      }

      logger.info('...... Checking Application is Active');
      // Check the application is active
      if (!application.data || !application.data.attributes.isActive) {
        logger.error('Application is not active!');
        const error = CustomError.badRequest({
          message: 'Application is not active!',
          hints: 'Please contact your system administrator',
        });
        return res.status(error.status).json(error);
      }

      const { powerlink } = task.application.data.attributes;

      logger.info('...... Checking powerLink exist');
      // Check the powerlink exist
      if (!powerlink.data) {
        logger.error('powerLink does not exist!');
        const error = CustomError.badRequest({
          message: 'powerLink does not exist!',
          hints: 'Please contact your system administrator',
        });
        return res.status(error.status).json(error);
      }

      // Check the powerlink is active
      if (!powerlink.data || !powerlink.data.attributes.isActive) {
        logger.error('powerLink is not active!');
        const error = CustomError.badRequest({
          message: 'powerLink is not active!',
          hints: 'Please contact your system administrator',
        });
        return res.status(error.status).json(error);
      }

      const { license } = powerlink.data.attributes;

      logger.info('...... Checking powerLink License exist and expiredAt exist');
      // Check the license is available for the powerlink
      if (!license || !license.expiresat) {
        logger.error('Powerlink has no available licenses!');
        const error = CustomError.badRequest({
          message: 'No License found for the requested powerLink!',
          hints: 'Please contact your system administrator',
        });
        return res.status(error.status).json(error);
      }

      logger.info('...... Checking powerLink License expiry date');
      // Check the license expired
      if (license.expiresat < moment().toISOString()) {
        logger.error('License expired for the requested powerLink!');
        const error = CustomError.badRequest({
          message: 'License expired for the requested powerLink!',
          hints: 'Please contact your system administrator',
        });
        return res.status(error.status).json(error);
      }

      logger.info('...... Checking powerLink License QUOTA');
      // Check if license model is QUOTA and limit is reached
      if (license.pricing.model === 'QUOTA' && license.limit - license.used <= 0) {
        logger.error('No enough quota license for the requested powerLink!');
        const error = CustomError.badRequest({
          message: 'No enough quota license for the requested powerLink!',
          hints: 'Please contact your system administrator',
        });
        return res.status(error.status).json(error);
      }

      // Check if license model is CONCURRENT (Phase 2)
      if (license.pricing.model === 'CONCURRENT') {
        // TODO: Concurrent license check (Phase 2)
      }
    }

    logger.info('... Checking Cusomter Submitted Data For Email');
    // Check submitted customer information for Email Notification
    if (
      !customer?.email &&
      ((emailNotification && emailNotification.isActive) ||
        (loginCodeEmailNotification && loginCodeEmailNotification.isActive))
    ) {
      logger.error('Insufficient customer information for email notifications');
      const error = CustomError.notAcceptable({
        message: 'Insufficient customer information for email notifications',
        hints: 'Please ensure your email addres is provided for the selected',
      });
      return res.status(error.status).json(error);
    }

    logger.info('... Checking Cusomter Submitted Data For Mobile');
    // Check submitted customer information for Mobile
    if (
      !customer?.mobile &&
      ((smsNotification && smsNotification.isActive) ||
        (whatsappNotification && whatsappNotification.isActive) ||
        (loginCodeSMSNotification && loginCodeSMSNotification.isActive) ||
        (loginCodeWhatsappNotification && loginCodeWhatsappNotification.isActive))
    ) {
      logger.error('Insufficient customer information for mobile notifications');
      const error = CustomError.notAcceptable({
        message: 'Insufficient customer information for mobile notifications',
        hints: 'Please ensure your mobile number is provided for the selected notification methods',
      });
      return res.status(error.status).json(error);
    }

    next();
  } catch (err: any) {
    console.log('Error:', err);
    next(err);
  }
};

export default prechecks;
