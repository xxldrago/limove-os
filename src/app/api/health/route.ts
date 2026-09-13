import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const timestamp = new Date().toISOString();
  const version = process.env.npm_package_version || '0.1.0';
  
  let dbStatus = 'disconnected';
  let monitors = 0;
  let transactions = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
    
    monitors = await prisma.siteMonitor.count();
    transactions = await prisma.transaction.count();
  } catch (error) {
    dbStatus = 'error';
  }

  return NextResponse.json({
    status: 'ok',
    timestamp,
    version,
    db: dbStatus,
    services: {
      postgres: dbStatus === 'connected' ? 'ok' : 'error',
      monitors,
      transactions,
    },
  });
}