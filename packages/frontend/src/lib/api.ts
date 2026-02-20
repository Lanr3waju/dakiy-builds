import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export interface ApiError {
  message: string;
  statusCode?: number;
  errors?: Record<string, string>;
}

export class ApiErrorHandler {
  static handleError(error: unknown): ApiError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      
      // Network error
      if (!axiosError.response) {
        return {
          message: 'Network error. Please check your connection and try again.',
          statusCode: 0,
        };
      }

      // Server returned error response
      const { status, data } = axiosError.response;
      
      // Extract error message
      let message = 'An unexpected error occurred';
      if (data?.message) {
        message = data.message;
      } else if (data?.error) {
        message = data.error;
      }

      // Extract validation errors if present
      const errors = data?.errors || data?.validationErrors;

      return {
        message,
        statusCode: status,
        errors,
      };
    }

    // Non-Axios error
    if (error instanceof Error) {
      return {
        message: error.message,
      };
    }

    return {
      message: 'An unexpected error occurred',
    };
  }

  static isNetworkError(error: ApiError): boolean {
    return error.statusCode === 0;
  }

  static isValidationError(error: ApiError): boolean {
    return error.statusCode === 400 && !!error.errors;
  }

  static isAuthError(error: ApiError): boolean {
    return error.statusCode === 401 || error.statusCode === 403;
  }

  static isNotFoundError(error: ApiError): boolean {
    return error.statusCode === 404;
  }

  static isServerError(error: ApiError): boolean {
    return !!error.statusCode && error.statusCode >= 500;
  }
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('API Request:', config.method?.toUpperCase(), config.url, 'Token:', token.substring(0, 20) + '...');
        } else {
          console.warn('API Request without token:', config.method?.toUpperCase(), config.url);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const errorData = error.response?.data as any;
        console.error('API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: errorData,
        });
        
        // Only logout on 401 (Unauthorized/Invalid token), not on 403 (Forbidden/Insufficient permissions)
        // Also check if it's actually an authentication error (not authorization)
        if (error.response?.status === 401) {
          const isAuthError = errorData?.message?.toLowerCase().includes('token') || 
                             errorData?.message?.toLowerCase().includes('session') ||
                             errorData?.message?.toLowerCase().includes('authentication');
          
          if (isAuthError) {
            console.warn('401 Authentication Error - Clearing token and redirecting to login');
            localStorage.removeItem('token');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  public getClient(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient().getClient();
export default apiClient;
