// components/ApiStateComponents.tsx - Componentes estándar reutilizables
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = "Cargando..." }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

type ErrorStateProps = {
  error?: string | null;
  onRetry?: () => void;
};

export function ErrorState({ error = "Error desconocido", onRetry }: ErrorStateProps) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Error al cargar datos
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

type EmptyStateProps = {
  message?: string;
  icon?: any;
  action?: React.ReactNode;
};

export function EmptyState({ 
  message = "No hay datos disponibles", 
  icon: Icon, 
  action 
}: EmptyStateProps) {
  const IconComponent = Icon || CheckCircle;
  
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <IconComponent className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">{message}</p>
        {action}
      </CardContent>
    </Card>
  );
}

type UpdateBadgeProps = {
  onRefresh?: () => void;
  show?: boolean;
};

export function UpdateBadge({ onRefresh, show = true }: UpdateBadgeProps) {
  if (!show) return null;
  
  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800 font-medium">
            Hay actualizaciones disponibles
          </span>
        </div>
        <Button size="sm" onClick={onRefresh} className="text-xs">
          Actualizar
        </Button>
      </div>
    </div>
  );
}