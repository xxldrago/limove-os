import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // ---------- USERS ----------
  const passwordLёsha = bcrypt.hashSync("леша", 10);
  const passwordGеna = bcrypt.hashSync("гена", 10);

  const lёsha = await prisma.user.upsert({
    where: { email: "aleksei@limove.ru" },
    update: {},
    create: {
      id: 1,
      name: "Лёша",
      email: "aleksei@limove.ru",
      passwordHash: passwordLёsha,
      role: "admin",
    },
  });

  const гena = await prisma.user.upsert({
    where: { email: "genadiy@limove.ru" },
    update: {},
    create: {
      id: 2,
      name: "Гена",
      email: "genadiy@limove.ru",
      passwordHash: passwordGеna,
      role: "partner",
    },
  });

  console.log(`👤 Users: ${lёsha.name}, ${гena.name}`);

  // ---------- PROJECTS ----------
  const kamni = await prisma.project.upsert({
    where: { slug: "kamni" },
    update: {},
    create: {
      slug: "kamni",
      name: "Камни",
      description: "Сайт для студии камня",
      status: "ACTIVE",
    },
  });

  const limove = await prisma.project.upsert({
    where: { slug: "limove" },
    update: {},
    create: {
      slug: "limove",
      name: "Limove",
      description: "Основной проект Limove OS",
      status: "ACTIVE",
    },
  });

  const womandreams = await prisma.project.upsert({
    where: { slug: "womandreams" },
    update: {},
    create: {
      slug: "womandreams",
      name: "WomanDreams",
      description: "Сайт для женских мечтаний",
      status: "ACTIVE",
    },
  });

  console.log(`📁 Projects: ${kamni.name}, ${limove.name}, ${womandreams.name}`);

  // ---------- EXPENSE TEMPLATES ----------
  const templates = [
    { name: "Keys.so", amount: 5300, category: "Подписка" },
    { name: "VPN Happ", amount: 7100, category: "VPN" },
    { name: "Амнезия", amount: 400, category: "VPN" },
    { name: "Тильда", amount: 1300, category: "Подписка" },
    { name: "Налог", amount: 0, category: "Налог" },
  ];

  for (const t of templates) {
    const existing = await prisma.expenseTemplate.findFirst({
      where: { name: t.name },
    });
    if (!existing) {
      await prisma.expenseTemplate.create({ data: t });
    }
  }

  console.log(`💳 Expense templates: ${templates.length}`);

  // ---------- SITE MONITORS ----------
  const monitors = [
    { name: "Камни", url: "rskrsk.ru" },
    { name: "Limove", url: "limove.ru" },
    { name: "Наследник", url: "naslednik24.ru" },
    { name: "Наследник Тильда", url: "naslednik124.ru" },
    { name: "WomanDreams", url: "womandreams.org" },
    { name: "7 Гусей", url: "7gusei.ru" },
    { name: "СибТоп", url: "sibtop.net" },
    { name: "Счастье в тебе", url: "schastievtebe.ru" },
    { name: "Красота технологии", url: "elmodskrsk.ru" },
    { name: "Вумфит", url: "vumfitkrsk.ru" },
  ];

  const kamniId = 1; // slugs above create ids 1..3
  for (const m of monitors) {
    const url = `https://${m.url}`;
    const existing = await prisma.siteMonitor.findUnique({ where: { url } });
    if (!existing) {
      await prisma.siteMonitor.create({
        data: {
          name: m.name,
          url,
          projectId: m.name === "Камни" ? kamni.id : m.name === "Limove" ? limove.id : null,
          isActive: true,
        },
      });
    }
  }

  console.log(`🌐 Site monitors: ${monitors.length}`);

  // ---------- SAMPLE TRANSACTIONS ----------
  const count = await prisma.transaction.count();
  if (count === 0) {
    await prisma.transaction.createMany({
      data: [
        {
          type: "INCOME",
          amount: 35000,
          description: "Оплата за разраробку Камни",
          paidById: lёsha.id,
          projectId: kamni.id,
          category: "Другое",
        },
        {
          type: "INCOME",
          amount: 50000,
          description: "Продление подписки Limove",
          paidById: lёsha.id,
          projectId: limove.id,
          category: "Другое",
        },
        {
          type: "INCOME",
          amount: 12000,
          description: "Контент-наполнение WomanDreams",
          paidById: гena.id,
          projectId: womandreams.id,
          category: "Другое",
        },
        {
          type: "EXPENSE",
          amount: 5300,
          description: "Keys.so подписка",
          paidById: lёsha.id,
          projectId: null,
          category: "Подписка",
        },
        {
          type: "EXPENSE",
          amount: 7100,
          description: "VPN Happ (обновление)",
          paidById: lёsha.id,
          projectId: null,
          category: "VPN",
        },
        {
          type: "EXPENSE",
          amount: 1300,
          description: "Тильда подписка",
          paidById: гena.id,
          projectId: null,
          category: "Подписка",
        },
        {
          type: "EXPENSE",
          amount: 15000,
          description: "Хостинг и домены",
          paidById: lёsha.id,
          projectId: null,
          category: "Хостинг",
        },
      ],
    });
    console.log("💰 Sample transactions created");
  } else {
    console.log("💰 Transactions already exist, skipping");
  }

  // ---------- VPN SUBSCRIPTIONS ----------
  const vpnCount = await prisma.vpnSubscription.count();
  if (vpnCount === 0) {
    await prisma.vpnSubscription.createMany({
      data: [
        {
          provider: "Happ",
          serverName: "Germany",
          clientName: "Мария Емельяново",
          url: "vpn://happ-germany-maria",
          connectedAt: new Date("2025-02-19"),
          expiresAt: new Date("2025-03-19"),
          status: "ACTIVE",
          notes: "Основная подписка Happ",
        },
        {
          provider: "Amnezia",
          serverName: "Amsterdam",
          clientName: "Люба",
          url: "amnezia://amsterdam-luba",
          connectedAt: new Date("2025-08-17"),
          expiresAt: null,
          status: "ACTIVE",
          notes: "2 subs 400₽",
        },
        {
          provider: "2kabana",
          serverName: null,
          clientName: "Наследник",
          url: "2kabana://naslednik",
          connectedAt: new Date("2025-04-07"),
          expiresAt: null,
          status: "ACTIVE",
          notes: "Ссылка",
        },
      ],
    });
    console.log("🔗 Sample VPN subscriptions created");
  } else {
    console.log("🔗 VPN subscriptions already exist, skipping");
  }

  // ---------- ELEMENTX USERS ----------
  const elemCount = await prisma.elementxUser.count();
  if (elemCount === 0) {
    await prisma.elementxUser.createMany({
      data: [
        {
          fullName: "Вадим Исмагилович",
          login: "vi",
          registerDate: new Date("2025-09-13"),
          paidDate: new Date("2025-09-13"),
          company: "РС",
          status: "PAID",
          notes: "Оплачено",
        },
        {
          fullName: "Александр Соснов",
          login: "alsosn",
          registerDate: new Date("2025-09-13"),
          paidDate: new Date("2025-09-13"),
          company: "РС",
          status: "PAID",
          notes: "Оплачено",
        },
        {
          fullName: "Яна Агент Старшая",
          login: "yan",
          registerDate: new Date("2025-09-13"),
          paidDate: new Date("2025-09-13"),
          company: "РС",
          status: "TRIAL",
          notes: "На тесте",
        },
        {
          fullName: "Мария Емельяново",
          login: "me",
          registerDate: new Date("2025-10-01"),
          paidDate: null,
          company: "WomanDreams",
          status: "READY_UNPAID",
          notes: "Ожидает оплаты",
        },
        {
          fullName: "Тест Пользователь",
          login: "test",
          registerDate: new Date("2025-11-15"),
          paidDate: null,
          company: "Наследник",
          status: "NOT_INSTALLED",
          notes: "Не установлен",
        },
      ],
    });
    console.log("🚀 Sample ElementX users created");
  } else {
    console.log("🚀 ElementX users already exist, skipping");
  }

  console.log("✅ Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });