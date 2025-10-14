// components/ui/empty-state.tsx - Empty state components for better UX

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trophy,
  Users,
  Calendar,
  FileX,
  Search,
  AlertCircle,
  Inbox,
  PlusCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: "default" | "outline" | "secondary";
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  const renderAction = (
    actionData: NonNullable<EmptyStateProps["action"]>,
    isPrimary: boolean = true
  ) => {
    const buttonContent = (
      <Button
        onClick={actionData.onClick}
        variant={isPrimary ? actionData.variant || "default" : "outline"}
        className={isPrimary ? "" : ""}
      >
        {actionData.label}
        {isPrimary && <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>
    );

    if (actionData.href) {
      return <Link href={actionData.href}>{buttonContent}</Link>;
    }

    return buttonContent;
  };

  return (
    <Card className={`border-dashed border-2 ${className}`}>
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        {icon && (
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            {icon}
          </div>
        )}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6 max-w-md">{description}</p>
        {action && (
          <div className="flex flex-col sm:flex-row gap-3">
            {renderAction(action, true)}
            {secondaryAction && renderAction(secondaryAction, false)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Predefined empty states for common scenarios

export function EmptyTournaments({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon={<Trophy className="w-8 h-8 text-orange-500" />}
      title="No hay torneos disponibles"
      description="Aún no estás inscrito en ningún torneo activo. Contacta con el administrador para unirte a un torneo."
      action={{
        label: "Contactar Administrador",
        href: "/contacto",
      }}
      secondaryAction={
        onRefresh
          ? {
              label: "Actualizar",
              onClick: onRefresh,
            }
          : undefined
      }
      className="bg-orange-50/50 border-orange-200"
    />
  );
}

export function EmptyGroup() {
  return (
    <EmptyState
      icon={<Users className="w-8 h-8 text-blue-500" />}
      title="Sin grupo asignado"
      description="Aún no has sido asignado a un grupo en la ronda actual. Espera a que comience la siguiente ronda."
      className="bg-blue-50/50 border-blue-200"
    />
  );
}

export function EmptyMatches() {
  return (
    <EmptyState
      icon={<Calendar className="w-8 h-8 text-green-500" />}
      title="No hay partidos pendientes"
      description="¡Excelente! Has completado todos tus partidos. Espera a que comience la siguiente ronda."
      className="bg-green-50/50 border-green-200"
    />
  );
}

export function EmptyHistory() {
  return (
    <EmptyState
      icon={<FileX className="w-8 h-8 text-gray-500" />}
      title="Sin historial"
      description="Aún no tienes partidos registrados. Tu historial aparecerá aquí una vez que comiences a jugar."
      action={{
        label: "Ver mi grupo actual",
        href: "/mi-grupo",
      }}
      className="bg-gray-50/50 border-gray-200"
    />
  );
}

export function EmptySearchResults({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon={<Search className="w-8 h-8 text-purple-500" />}
      title="No se encontraron resultados"
      description="No hay resultados que coincidan con tu búsqueda. Intenta con otros términos."
      action={
        onClear
          ? {
              label: "Limpiar búsqueda",
              onClick: onClear,
              variant: "outline",
            }
          : undefined
      }
      className="bg-purple-50/50 border-purple-200"
    />
  );
}

export function EmptyRanking() {
  return (
    <EmptyState
      icon={<Trophy className="w-8 h-8 text-yellow-500" />}
      title="Ranking no disponible"
      description="El ranking se generará después de la primera ronda completada."
      className="bg-yellow-50/50 border-yellow-200"
    />
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="w-8 h-8 text-red-500" />}
      title="Error al cargar los datos"
      description={
        message || "Ha ocurrido un error inesperado. Por favor, intenta nuevamente."
      }
      action={
        onRetry
          ? {
              label: "Reintentar",
              onClick: onRetry,
              variant: "default",
            }
          : undefined
      }
      secondaryAction={{
        label: "Recargar página",
        onClick: () => window.location.reload(),
      }}
      className="bg-red-50/50 border-red-200"
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={<Inbox className="w-8 h-8 text-indigo-500" />}
      title="Sin notificaciones"
      description="No tienes notificaciones pendientes. Te avisaremos cuando haya algo nuevo."
      className="bg-indigo-50/50 border-indigo-200"
    />
  );
}

export function EmptyAdminGroups({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="w-8 h-8 text-orange-500" />}
      title="No hay grupos creados"
      description="Aún no se han creado grupos para esta ronda. Crea los grupos manualmente o genera la siguiente ronda."
      action={
        onCreate
          ? {
              label: "Crear grupos",
              onClick: onCreate,
            }
          : undefined
      }
      className="bg-orange-50/50 border-orange-200"
    />
  );
}

export function EmptyAdminTournaments({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Trophy className="w-8 h-8 text-orange-500" />}
      title="No hay torneos"
      description="Aún no has creado ningún torneo. Crea tu primer torneo para comenzar."
      action={
        onCreate
          ? {
              label: "Crear Torneo",
              onClick: onCreate,
            }
          : {
              label: "Crear Torneo",
              href: "/admin/torneos/nuevo",
            }
      }
      className="bg-orange-50/50 border-orange-200"
    />
  );
}

export function EmptyPlayers({ onInvite }: { onInvite?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="w-8 h-8 text-blue-500" />}
      title="No hay jugadores"
      description="Aún no se han registrado jugadores. Invita a jugadores para comenzar."
      action={
        onInvite
          ? {
              label: "Invitar Jugadores",
              onClick: onInvite,
            }
          : undefined
      }
      className="bg-blue-50/50 border-blue-200"
    />
  );
}

export function LoadingState({ message }: { message?: string }) {
  return (
    <Card className="border-dashed border-2">
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {message || "Cargando..."}
        </h3>
        <p className="text-gray-600">Por favor espera un momento</p>
      </CardContent>
    </Card>
  );
}

// Compact empty state for smaller areas
export function CompactEmptyState({
  icon,
  message,
  action,
}: {
  icon?: ReactNode;
  message: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}) {
  const renderAction = () => {
    if (!action) return null;

    const buttonContent = (
      <Button size="sm" variant="outline" onClick={action.onClick}>
        {action.label}
      </Button>
    );

    if (action.href) {
      return <Link href={action.href}>{buttonContent}</Link>;
    }

    return buttonContent;
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
      {icon && <div className="mb-2">{icon}</div>}
      <p className="text-sm text-gray-600 mb-3">{message}</p>
      {renderAction()}
    </div>
  );
}
