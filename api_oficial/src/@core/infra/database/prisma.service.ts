import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // ✅ Adicionar parâmetros de connection pool à URL existente
    const databaseUrl = process.env.DATABASE_LINK;
    const separator = databaseUrl.includes('?') ? '&' : '?';
    const urlWithPool = `${databaseUrl}${separator}connection_limit=5&pool_timeout=20`;
    
    super({
      datasources: {
        db: {
          url: urlWithPool,
        },
      },
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
