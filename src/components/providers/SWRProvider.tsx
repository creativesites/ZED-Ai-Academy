"use client";

import React from "react";
import { SWRConfig } from "swr";
import { useNetwork } from "./NetworkStatusProvider";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  const { triggerNetworkError, clearNetworkError } = useNetwork();

  const customFetcher = async (url: string) => {
    try {
      const res = await fetch(url);
      
      if (!res.ok) {
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch (_) {}

        const errorMessage = errorData.error || `Server request failed (Status ${res.status})`;
        const error = new Error(errorMessage) as any;
        error.status = res.status;
        error.info = errorData;
        throw error;
      }

      return await res.json();
    } catch (err: any) {
      // If it's already an HTTP error thrown with status, keep it
      if (err.status) {
        throw err;
      }

      // Otherwise, it's a client-side network error (offline, DNS failure, cors, etc.)
      const networkError = new Error(
        "Failed to load. Please check your network connection and try again."
      ) as any;
      networkError.isNetworkError = true;
      networkError.originalError = err;
      throw networkError;
    }
  };

  return (
    <SWRConfig
      value={{
        fetcher: customFetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        // Automatically alert the network handler on connection-level errors
        onError: (error, key) => {
          if (error.isNetworkError) {
            triggerNetworkError(
              "Unable to connect to the server. Please check your internet connection."
            );
          } else {
            console.error(`[SWR Error for "${key}"]:`, error);
          }
        },
        // Automatically clear network errors once fetches succeed again
        onSuccess: () => {
          clearNetworkError();
        },
        // Exponential backoff for retry, but skip retry for specific HTTP status codes
        shouldRetryOnError: (error) => {
          // Do not retry on client errors (400, 401, 403, 404)
          if (error.status && error.status >= 400 && error.status < 500) {
            return false;
          }
          return true;
        },
        errorRetryInterval: 5000, // Try every 5 seconds on error
      }}
    >
      {children}
    </SWRConfig>
  );
}
