import { Request, Response, NextFunction } from 'express';
import jobService from '@/v1/services/job';
import logger from '@/config/logger';
import { FetchWorkflowDataSchema } from '@/v1/schemas/job';
import CustomError from '@/utils/Error';

// Augment the Request type to include the 'workflowData' property
declare module 'express-serve-static-core' {
  interface Request {
    workflowData: any;
  }
}

const fetchWorkflowData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers['authorization'];

    // Validate the request body
    const parsedBody = FetchWorkflowDataSchema.safeParse(req.body.data);
    if (!parsedBody.success) {
      const error = CustomError.badRequest({
        message: 'Invalid request body',
        errors: parsedBody.error.errors,
        hints: 'Please check the request body and try again later',
      });
      return res.status(error.status).json(error);
    }

    const { workflow: workflowId } = parsedBody.data;

    const workflowData = await jobService.getWorkflowById(
      workflowId as number,
      token as string
    );

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

    // Attach workflowData to the req object
    req.workflowData = workflowData;
    next();
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

export default fetchWorkflowData;
