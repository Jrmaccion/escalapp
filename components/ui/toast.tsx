// components/ui/toast.tsx - Toast notification system

"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  hideToast: (id: string) => void;
  success: (title: string, description?: string, duration?: number) => void;
  error: (title: string, description?: string, duration?: number) => void;
  warning: (title: string, description?: string, duration?: number) => void;
  info: (title: string, description?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after duration (default 5 seconds)
    const duration = toast.duration || 5000;
    setTimeout(() => {
      hideToast(id);
    }, duration);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback(
    (title: string, description?: string, duration?: number) => {
      showToast({ type: "success", title, description, duration });
    },
    [showToast]
  );

  const error = useCallback(
    (title: string, description?: string, duration?: number) => {
      showToast({ type: "error", title, description, duration });
    },
    [showToast]
  );

  const warning = useCallback(
    (title: string, description?: string, duration?: number) => {
      showToast({ type: "warning", title, description, duration });
    },
    [showToast]
  );

  const info = useCallback(
    (title: string, description?: string, duration?: number) => {
      showToast({ type: "info", title, description, duration });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, hideToast, success, error, warning, info }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Toast Container Component
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Individual Toast Item Component
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          containerClass: "bg-green-50 border-green-200",
          iconClass: "text-green-600",
          Icon: CheckCircle,
        };
      case "error":
        return {
          containerClass: "bg-red-50 border-red-200",
          iconClass: "text-red-600",
          Icon: XCircle,
        };
      case "warning":
        return {
          containerClass: "bg-yellow-50 border-yellow-200",
          iconClass: "text-yellow-600",
          Icon: AlertTriangle,
        };
      case "info":
        return {
          containerClass: "bg-blue-50 border-blue-200",
          iconClass: "text-blue-600",
          Icon: Info,
        };
    }
  };

  const { containerClass, iconClass, Icon } = getToastStyles(toast.type);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-right-full duration-300",
        containerClass
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{toast.title}</p>
        {toast.description && (
          <p className="text-gray-600 text-sm mt-1">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Utility function for showing toasts outside of React components
let toastContextRef: ToastContextValue | null = null;

export function setToastContext(context: ToastContextValue) {
  toastContextRef = context;
}

export const toast = {
  success: (title: string, description?: string, duration?: number) => {
    if (toastContextRef) {
      toastContextRef.success(title, description, duration);
    } else {
      console.warn("Toast context not initialized");
    }
  },
  error: (title: string, description?: string, duration?: number) => {
    if (toastContextRef) {
      toastContextRef.error(title, description, duration);
    } else {
      console.warn("Toast context not initialized");
    }
  },
  warning: (title: string, description?: string, duration?: number) => {
    if (toastContextRef) {
      toastContextRef.warning(title, description, duration);
    } else {
      console.warn("Toast context not initialized");
    }
  },
  info: (title: string, description?: string, duration?: number) => {
    if (toastContextRef) {
      toastContextRef.info(title, description, duration);
    } else {
      console.warn("Toast context not initialized");
    }
  },
};

/**
 * Usage examples:
 *
 * // In a React component:
 * const { success, error } = useToast();
 * success("¡Éxito!", "Los datos se guardaron correctamente");
 * error("Error", "No se pudo guardar los datos");
 *
 * // Outside React components (after context is initialized):
 * toast.success("¡Éxito!", "Operación completada");
 * toast.error("Error", "Algo salió mal");
 */
