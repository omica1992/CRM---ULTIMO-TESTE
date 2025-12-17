import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * ✅ Módulo GLOBAL do Prisma
 * 
 * Garante que apenas UMA instância do PrismaService seja criada
 * e compartilhada entre todos os módulos da aplicação.
 * 
 * Isso previne o esgotamento do pool de conexões do PostgreSQL.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
