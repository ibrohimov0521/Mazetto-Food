export type ApiErrorResponse = {
  success: false;
  error: {
    statusCode: number;
    code: string;
    message: string | string[];
    details?: unknown;
    path: string;
    requestId: string;
    timestamp: string;
  };
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};
