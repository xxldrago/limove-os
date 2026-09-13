import { PrismaClient } from "@prisma/client";
import { encrypt } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  const kamni = await prisma.project.findUnique({ where: { slug: "kamni" } });
  if (!kamni) {
    console.log("Project kamni not found, run main seed first");
    return;
  }

  // Demo credentials
  const credCount = await prisma.credential.count({ where: { projectId: kamni.id } });
  if (credCount === 0) {
    await prisma.credential.createMany({
      data: [
        {
          projectId: kamni.id,
          serviceName: "WordPress",
          login: "admin",
          passwordEnc: encrypt("admin123"),
          url: "kamni.ru/wp-admin",
          expiresAt: new Date(Date.now() + 15 * 86400000),
          notes: "Основной доступ",
        },
        {
          projectId: kamni.id,
          serviceName: "Почта",
          login: "info@kamni.ru",
          passwordEnc: encrypt("mailpass"),
          url: null,
          expiresAt: null,
          notes: "",
        },
      ],
    });
    console.log("Added demo credentials");
  }

  // Demo domains
  const domCount = await prisma.domainRecord.count({ where: { projectId: kamni.id } });
  if (domCount === 0) {
    await prisma.domainRecord.createMany({
      data: [
        {
          projectId: kamni.id,
          name: "Домен",
          value: "kamni.ru",
          expiresAt: new Date(Date.now() + 45 * 86400000),
          reminderDays: 7,
          notes: "Основной домен",
        },
        {
          projectId: kamni.id,
          name: "Хостинг",
          value: "beget-host",
          expiresAt: new Date(Date.now() + 10 * 86400000),
          reminderDays: 7,
          notes: "",
        },
      ],
    });
    console.log("Added demo domains");
  }

  // Demo tasks
  const taskCount = await prisma.task.count({ where: { projectId: kamni.id } });
  if (taskCount === 0) {
    await prisma.task.createMany({
      data: [
        { projectId: kamni.id, title: "Сделать редизайн", status: "BACKLOG", priority: "MEDIUM", sortOrder: 0 },
        { projectId: kamni.id, title: "Настроить домен", status: "IN_PROGRESS", priority: "HIGH", assigneeId: 1, dueDate: new Date(Date.now() + 5 * 86400000), sortOrder: 0 },
        { projectId: kamni.id, title: "Загрузить товары", status: "DONE", priority: "LOW", assigneeId: 2, sortOrder: 0 },
      ],
    });
    console.log("Added demo tasks");
  }

  // Demo notes
  const noteCount = await prisma.note.count({ where: { projectId: kamni.id } });
  if (noteCount === 0) {
    await prisma.note.createMany({
      data: [
        { projectId: kamni.id, title: "Идеи", content: "Добавить галерею камня", pinned: true },
        { projectId: kamni.id, title: "Встреча", content: "Встреча с клиентом в четверг", pinned: false },
      ],
    });
    console.log("Added demo notes");
  }

  console.log("Seed demo data done");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
