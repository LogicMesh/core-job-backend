import { ErrorDetail } from '@/types';

const formatError = (err: any): ErrorDetail => {
  const error: ErrorDetail = {
    message: err?.message ? err.message : err.toString(),
    errors: err.errors || [],
    hints: err.hints
      ? `${err.hints}. If the problem is not resolved, please feel free to contact our technical team with the trace_id`
      : 'Please Create a support ticket with the trace_id for further assistance. or contact our technical team with the trace_id',
  };

  return error;
};

export default formatError;
