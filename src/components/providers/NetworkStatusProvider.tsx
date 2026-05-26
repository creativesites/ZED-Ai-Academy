"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { WifiOff, RefreshCw, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NetworkContextType {
  isOnline: boolean;
  hasNetworkError: boolean;
  networkErrorMessage: string | null;
  triggerNetworkError: (message: string) => void;
  clearNetworkError: () => void;
  testConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [hasNetworkError, setHasNetworkError] = useState<boolean>(false);
  const [networkErrorMessage, setNetworkErrorMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<"success" | "fail" | null>(null);

  // Synchronize initial state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setHasNetworkError(false);
      setNetworkErrorMessage(null);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const triggerNetworkError = (message: string) => {
    setHasNetworkError(true);
    setNetworkErrorMessage(message);
  };

  const clearNetworkError = () => {
    setHasNetworkError(false);
    setNetworkErrorMessage(null);
  };

  // Perform a lightweight network request to verify active connection
  const testConnection = async (): Promise<boolean> => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Fetch a tiny image/favicon with cache-busting to bypass network caching
      const response = await fetch(`/favicon.ico?t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
      });
      
      if (response.ok) {
        setIsOnline(true);
        setHasNetworkError(false);
        setNetworkErrorMessage(null);
        setTestResult("success");
        setTimeout(() => setTestResult(null), 3000);
        setIsTesting(false);
        return true;
      }
      throw new Error("Ping failed");
    } catch (e) {
      setTestResult("fail");
      setTimeout(() => setTestResult(null), 3000);
      setIsTesting(false);
      return false;
    }
  };

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        hasNetworkError,
        networkErrorMessage,
        triggerNetworkError,
        clearNetworkError,
        testConnection,
      }}
    >
      {children}

      {/* 1. Global Offline Overlay (Full Screen Glassmorphism) */}
      {!isOnline && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 bg-[#062e39]/80 backdrop-blur-lg animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-[#fd5523]/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-[#062e39]/40 blur-3xl" />

            <div className="relative space-y-6">
              {/* Pulsing connection status icon */}
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fd5523]/10 border border-[#fd5523]/20 text-[#fd5523] animate-pulse">
                <WifiOff className="h-10 w-10" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">Network Connection Lost</h2>
                <p className="text-sm leading-relaxed text-slate-300">
                  Zed AI Academy is currently unreachable. Please check your wi-fi, cellular data, or local ethernet connection.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
                <Button
                  onClick={testConnection}
                  disabled={isTesting}
                  className="rounded-full bg-[#fd5523] px-8 py-5 font-bold text-white hover:bg-[#ef4a16] shadow-lg shadow-[#fd5523]/20 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isTesting ? "animate-spin" : ""}`} />
                  {isTesting ? "Testing..." : "Test Connection"}
                </Button>
              </div>

              {/* Status alerts based on testConnection result */}
              {testResult === "success" && (
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-semibold mt-2 animate-bounce">
                  <CheckCircle2 className="h-4 w-4" />
                  Connection verified! Refreshing...
                </div>
              )}
              {testResult === "fail" && (
                <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-semibold mt-2 animate-shake">
                  <AlertCircle className="h-4 w-4" />
                  Still offline. Double-check your connection.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Top-sliding warning banner for temporary, non-fatal API/network issues */}
      {isOnline && hasNetworkError && (
        <div className="fixed top-4 left-1/2 z-[9990] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 p-0.5 rounded-2xl bg-gradient-to-r from-[#fd5523] to-[#062e39] shadow-xl animate-slide-down">
          <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[#f8f7f4]/95 backdrop-blur-md px-4 py-3 border border-white/40">
            <div className="flex items-center gap-2 text-[#062e39]">
              <AlertCircle className="h-5 w-5 shrink-0 text-[#fd5523]" />
              <div className="text-xs sm:text-sm font-medium">
                <span className="font-bold text-[#fd5523] mr-1">Network Error:</span>
                {networkErrorMessage || "Failed to communicate with the server."}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={testConnection}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Retry network connection"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={clearNetworkError}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Dismiss warning"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkStatusProvider");
  }
  return context;
}
