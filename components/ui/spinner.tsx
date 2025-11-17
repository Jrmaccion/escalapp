// components/ui/spinner.tsx - Componente de loading estandarizado
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type SpinnerProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <RefreshCw
      className={cn("animate-spin text-primary", sizeClasses[size], className)}
    />
  );
}

// Variant con texto
export type SpinnerWithTextProps = SpinnerProps & {
  message?: string;
};

export function SpinnerWithText({
  size = "md",
  message = "Cargando...",
  className,
}: SpinnerWithTextProps) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <div className="text-center">
        <Spinner size={size} className="mx-auto mb-3" />
        <p className="text-gray-600 text-sm">{message}</p>
      </div>
    </div>
  );
}
