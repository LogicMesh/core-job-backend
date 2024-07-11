export interface ErrorDetail {
  message: string;
  errors: any[];
  hints: string;
}

export interface CustomErrorInterface extends Error {
  status?: number;
  errors?: any[];
  hints?: string;
}

export interface Query {
  fields?: string;
}

export interface ValidationResult {
  invalidFields: string[];
  validFields: Record<string, boolean>;
}

export interface QueryValidationParams {
  query: Query;
  allowedFields: string[];
}

export type EmailOptions = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

export type SMSOptions = {
  origin: string;
  destination: string;
  message: string;
};
