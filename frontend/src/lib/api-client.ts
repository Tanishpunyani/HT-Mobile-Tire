/**
 * API Client helper for HT Mobile Tires
 * Provides unified credentials handling, authentication error trapping, and structured error responses.
 */
import { logger } from "@/lib/logger";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  customer?: any;
  emergencyRequests?: any[];
  contactInquiries?: any[];
  bookings?: any[];
  error?: string;
  code?: string;
  status: number;
  needsOnboarding?: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  needsOnboarding?: boolean;

  constructor(message: string, status: number, code?: string, needsOnboarding?: boolean) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.needsOnboarding = needsOnboarding;
  }
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const config: RequestInit = {
    ...options,
    credentials: "include", // Ensure cookies/JWT are always transmitted
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(endpoint, config);
    let data: any = null;

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (parseErr) {
        logger.warn("api_client.json_parse_failed", { endpoint, error: parseErr });
      }
    }

    if (!response.ok) {
      const errorMessage =
        data?.error ||
        data?.message ||
        `Request failed with status ${response.status} (${response.statusText})`;

      logger.error("api_client.response_error", {
        endpoint,
        status: response.status,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        code: data?.code,
        status: response.status,
        needsOnboarding: data?.needsOnboarding || response.status === 404,
        ...data,
      };
    }

    return {
      success: true,
      status: response.status,
      ...data,
    };
  } catch (networkError: any) {
    logger.error("api_client.network_exception", {
      endpoint,
      error: networkError,
    });
    return {
      success: false,
      error: networkError?.message || "Network connection failed. Please check your internet connection.",
      status: 0,
      code: "NETWORK_ERROR",
    };
  }
}
