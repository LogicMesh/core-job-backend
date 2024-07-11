import { CustomErrorInterface, ErrorDetail } from '@/types';
import formatError from './formatError';

class CustomError {
  static notFound(error: any): { status: number } & ErrorDetail {
    const err = formatError(error);
    return {
      status: 404,
      ...err,
    };
  }

  static unauthorized(error: any): { status: number } & ErrorDetail {
    const err = formatError(error);
    return {
      status: 401,
      ...err,
    };
  }

  static badRequest(error: any): { status: number } & ErrorDetail {
    const err = formatError(error);
    return {
      status: 400,
      ...err,
    };
  }

  static forbidden(error: any): { status: number } & ErrorDetail {
    const err = formatError(error);
    return {
      status: 403,
      ...err,
    };
  }

  static notAcceptable(error: any): { status: number } & ErrorDetail {
    const err = formatError(error);
    return {
      status: 406,
      ...err,
    };
  }

  static serverError(error: any): { status: number } & ErrorDetail {
    const err = formatError(error);
    return {
      status: 500,
      ...err,
    };
  }

  static throwError(error: CustomErrorInterface): never {
    const err: CustomErrorInterface = new Error(
      error.message
    ) as CustomErrorInterface;
    err.status = error.status;
    err.errors = error.errors;
    err.hints = error.hints;

    throw err;
  }
}

export default CustomError;
