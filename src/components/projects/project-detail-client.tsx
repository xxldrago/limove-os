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
    <div className="fern-panel">
      <div className="detail-head">
        <Link href="/projects" className="back-btn" aria-label="Назад к проектам">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="detail-title">{projectData.name}</h1>
        <span className="badge badge-neutral">
          {STATUS_LABELS[projectData.status] ?? projectData.status}
        </span>
        <span
          className={`badge ${
            projectData.siteStatus === "UP"
              ? "badge-success"
              : projectData.siteStatus === "DOWN"
                ? "badge-danger"
                : "badge-neutral"
          }`}
        >
          {projectData.siteStatus === "UP"
            ? "🟢 UP"
            : projectData.siteStatus === "DOWN"
              ? "🔴 DOWN"
              : "⚪ UNKNOWN"}
        </span>
      </div>

      <div className="detail-body">
      <Tabs defaultValue="overview">
        <TabsList>
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
