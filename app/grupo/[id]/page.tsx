// app/grupo/[id]/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import GroupDetailClient from "./GroupDetailClient";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function GroupDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  return <GroupDetailClient groupId={params.id} />;
}