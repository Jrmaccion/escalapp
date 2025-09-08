"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  withText?: boolean;
  textClassName?: string;
  title?: string;
  size?: number; // px
};

/**
 * Logo PadelRise usando /public/favicon.ico
 * - Sin fondos/gradientes
 * - Escalable vía prop `size`
 */
export default function Logo({
  className,
  withText = false,
  textClassName,
  title = "PadelRise",
  size = 40, // ⬅️ default más grande
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/favicon.ico"
        alt={title}
        width={size}
        height={size}
        className="rounded-lg"
        priority
      />

      {withText && (
        <span
          className={cn(
            "font-extrabold text-lg text-gray-900 tracking-tight",
            textClassName
          )}
          title={title}
        >
          PadelRise
        </span>
      )}
    </div>
  );
}
