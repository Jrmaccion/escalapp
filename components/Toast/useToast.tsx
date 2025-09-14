// components/Toast/useToast.tsx - Sistema de feedback mejorado
"use client";

import { useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, Loader2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
}

interface ToastState {
  toasts: Toast[];
}

// Hook personalizado para manejar toasts
export function useToast() {
  const [state, setState] = useState<ToastState>({ toasts: [] });

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 5000, // 5 segundos por defecto
      ...toast,
    };

    setState(prev => ({
      toasts: [...prev.toasts, newToast],
    }));

    // Auto-remove si no es persistente o loading
    if (!newToast.persistent && newToast.type !== 'loading' && newToast.duration) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setState(prev => ({
      toasts: prev.toasts.filter(toast => toast.id !== id),
    }));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setState(prev => ({
      toasts: prev.toasts.map(toast =>
        toast.id === id ? { ...toast, ...updates } : toast
      ),
    }));
  }, []);

  // Métodos de conveniencia
  const toast = {
    success: (title: string, description?: string, action?: Toast['action']) =>
      addToast({ type: 'success', title, description, action }),
    
    error: (title: string, description?: string, action?: Toast['action']) =>
      addToast({ type: 'error', title, description, action, persistent: true }),
    
    warning: (title: string, description?: string) =>
      addToast({ type: 'warning', title, description }),
    
    info: (title: string, description?: string) =>
      addToast({ type: 'info', title, description }),
    
    loading: (title: string, description?: string) =>
      addToast({ type: 'loading', title, description, persistent: true }),
    
    promise: async <T,>(
      promise: Promise<T>,
      {
        loading: loadingMessage,
        success: successMessage,
        error: errorMessage,
      }: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      }
    ) => {
      const loadingId = addToast({
        type: 'loading',
        title: loadingMessage,
        persistent: true,
      });

      try {
        const data = await promise;
        removeToast(loadingId);
        
        const message = typeof successMessage === 'function' 
          ? successMessage(data) 
          : successMessage;
        
        addToast({
          type: 'success',
          title: message,
        });
        
        return data;
      } catch (error) {
        removeToast(loadingId);
        
        const message = typeof errorMessage === 'function' 
          ? errorMessage(error) 
          : errorMessage;
        
        addToast({
          type: 'error',
          title: message,
          persistent: true,
        });
        
        throw error;
      }
    },
  };

  return {
    toasts: state.toasts,
    toast,
    removeToast,
    updateToast,
  };
}

// Componente Toast individual
function ToastComponent({ toast, onRemove }: { 
  toast: Toast; 
  onRemove: (id: string) => void;
}) {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
    loading: Loader2,
  };

  const Icon = icons[toast.type];

  const getToastClasses = () => {
    const base = "relative p-4 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 transform translate-x-0 opacity-100";
    
    switch (toast.type) {
      case 'success':
        return `${base} bg-green-50 border-green-200 text-green-800`;
      case 'error':
        return `${base} bg-red-50 border-red-200 text-red-800`;
      case 'warning':
        return `${base} bg-yellow-50 border-yellow-200 text-yellow-800`;
      case 'info':
        return `${base} bg-blue-50 border-blue-200 text-blue-800`;
      case 'loading':
        return `${base} bg-gray-50 border-gray-200 text-gray-800`;
      default:
        return base;
    }
  };

  const getIconClasses = () => {
    switch (toast.type) {
      case 'success': return "text-green-500";
      case 'error': return "text-red-500";
      case 'warning': return "text-yellow-500";
      case 'info': return "text-blue-500";
      case 'loading': return "text-gray-500 animate-spin";
      default: return "text-gray-500";
    }
  };

  return (
    <div className={getToastClasses()}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${getIconClasses()}`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
          {toast.description && (
            <p className="text-sm opacity-90 mt-1">{toast.description}</p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-sm font-medium underline mt-2 hover:no-underline focus:outline-none"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        {toast.type !== 'loading' && (
          <button
            onClick={() => onRemove(toast.id)}
            className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Provider de Toasts
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, removeToast } = useToast();

  return (
    <>
      {children}
      
      {/* Container de toasts */}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto animate-in slide-in-from-right-5">
            <ToastComponent toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </>
  );
}

// Hook para acciones de API con feedback optimista
export function useApiAction() {
  const { toast } = useToast();

  const executeAction = useCallback(async <T,>(
    action: () => Promise<T>,
    options: {
      loadingMessage: string;
      successMessage: string | ((data: T) => string);
      errorMessage?: string | ((error: any) => string);
      optimisticUpdate?: () => void;
      onSuccess?: (data: T) => void;
      onError?: (error: any) => void;
    }
  ) => {
    // Aplicar update optimista si se proporciona
    if (options.optimisticUpdate) {
      options.optimisticUpdate();
    }

    try {
      const data = await toast.promise(action(), {
        loading: options.loadingMessage,
        success: options.successMessage,
        error: options.errorMessage || 'Ha ocurrido un error',
      });

      if (options.onSuccess) {
        options.onSuccess(data);
      }

      return data;
    } catch (error) {
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    }
  }, [toast]);

  return { executeAction };
}

// Ejemplo de uso en componentes
export function ExampleUsage() {
  const { toast } = useToast();
  const { executeAction } = useApiAction();

  const handleConfirmMatch = async () => {
    await executeAction(
      () => fetch('/api/matches/123/confirm', { method: 'POST' }),
      {
        loadingMessage: 'Confirmando partido...',
        successMessage: '¡Partido confirmado!',
        errorMessage: 'No se pudo confirmar el partido',
        optimisticUpdate: () => {
          // Update UI inmediato (optimista)
          console.log('Actualizando UI optimistamente');
        },
        onSuccess: (data) => {
          // Acciones post-éxito
          console.log('Partido confirmado:', data);
        }
      }
    );
  };

  const handleComplexAction = async () => {
    try {
      const response = await fetch('/api/complex-action', { method: 'POST' });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error desconocido');
      }

      toast.success('Acción completada', 'Todo salió bien', {
        label: 'Ver detalles',
        onClick: () => console.log('Mostrar detalles')
      });

    } catch (error: any) {
      toast.error('Error en la acción', error.message, {
        label: 'Reintentar',
        onClick: () => handleComplexAction()
      });
    }
  };

  return (
    <div className="space-y-4 p-4">
      <button
        onClick={handleConfirmMatch}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Confirmar Partido (con feedback optimista)
      </button>
      
      <button
        onClick={handleComplexAction}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        Acción Compleja (con retry)
      </button>
      
      <button
        onClick={() => toast.info('Información', 'Esto es un mensaje informativo')}
        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
      >
        Toast de Información
      </button>
    </div>
  );
}