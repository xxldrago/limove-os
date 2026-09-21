"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import type { ProjectData } from "./types";
import { STATUS_LABELS } from "./types";

import { OverviewTab } from "./tab-overview";
import { CredentialsTab } from "./tab-credentials";
import { DomainsTab } from "./tab-domains";
import { TasksTab } from "./tab-tasks";
import { NotesTab } from "./tab-notes";
import { FilesTab } from "./tab-files";
import { InvoicesTab } from "./tab-invoices";
import { AnalyticsTab } from "./tab-analytics";

interface Props {
  project: ProjectData;
}

export function ProjectDetailClient({ project }: Props) {
  const [projectData, setProjectData] = useState<ProjectData>(project);

  const handleProjectUpdate = (patch: Partial<ProjectData>) => {
    setProjectData((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="fern-panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#eef2f6] px-7 pb-5 pt-[26px]">
        <Link
          href="/projects"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#e4e9ef] text-[#5d6b7c] transition hover:bg-[#f5f8fa] hover:text-[#0f1720]"
          aria-label="Назад к проектам"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="m-0 text-[20px] font-bold tracking-[-0.028em] text-[#0f1720]">{projectData.name}</h1>
        <Badge variant="outline">
          {STATUS_LABELS[projectData.status] ?? projectData.status}
        </Badge>
        <Badge variant="outline" className={
          projectData.siteStatus === "UP"
            ? "bg-green-500/15 text-green-700 dark:text-green-400"
            : projectData.siteStatus === "DOWN"
              ? "bg-red-500/15 text-red-700 dark:text-red-400"
              : "bg-muted text-muted-foreground"
        }>
          {projectData.siteStatus === "UP"
            ? "🟢 UP"
            : projectData.siteStatus === "DOWN"
              ? "🔴 DOWN"
              : "⚪ UNKNOWN"}
        </Badge>
      </div>

      <div className="px-7 py-6">
      <Tabs defaultValue="overview">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="credentials">Доступы</TabsTrigger>
          <TabsTrigger value="domains">Домены</TabsTrigger>
          <TabsTrigger value="tasks">Задачи</TabsTrigger>
          <TabsTrigger value="notes">Заметки</TabsTrigger>
          <TabsTrigger value="files">Файлы</TabsTrigger>
          <TabsTrigger value="invoices">Счета</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            project={projectData}
            onProjectUpdate={handleProjectUpdate}
          />
        </TabsContent>
        <TabsContent value="credentials">
          <CredentialsTab project={projectData} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
        <TabsContent value="domains">
          <DomainsTab project={projectData} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab project={projectData} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab project={projectData} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
        <TabsContent value="files">
          <FilesTab project={projectData} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab project={projectData} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab projectId={projectData.id} slug={projectData.slug} />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
