import { Request, Response, NextFunction } from 'express';
import axios, { AxiosResponse } from 'axios';
import logger from '@/config/logger';
import { STRAPI_URL } from '@/config/config_url';
import CustomError from '@/utils/Error';

// Augment the Request type to include the 'user' property
declare module 'express-serve-static-core' {
  interface Request {
    user: any;
  }
}

const strapiAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('>>>>>>>>>>>>>>> strapiAuthenticate Middleware >>>>>>>>>>>>>>>>>>>>>>>>>');

    const token = req.headers['authorization'];

    // Check if the token is provided
    if (!token) {
      logger.error('No token provided');
      const error = CustomError.unauthorized({
        message: 'No token provided!',
      });
      return res.status(error.status).json(error);
    }

    const response: AxiosResponse = await axios.get(`${STRAPI_URL}/users/me`, {
      headers: {
        Authorization: token,
      },
    });

    req.user = response.data;
    next();
  } catch (err) {
    logger.info('Error catch in strapiAuthenticate');
    return res.status(401).json({ message: 'Token is invalid!' });
  }
};

export default strapiAuthenticate;
