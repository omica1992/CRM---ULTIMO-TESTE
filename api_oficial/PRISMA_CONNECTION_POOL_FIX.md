# Correção: Pool de Conexões PostgreSQL Esgotado

## Problema Identificado

```
FATAL: desculpe, muitos clientes conectados
Too many database connections opened
```

### Causa Raiz

O `PrismaService` estava sendo **declarado em múltiplos módulos** do NestJS:
- `AppModule`
- `CompaniesModule`
- `SendMessageWhatsappModule`

Isso causava a criação de **múltiplas instâncias** do Prisma Client, cada uma abrindo seu próprio pool de conexões com o PostgreSQL, rapidamente esgotando o limite de conexões do banco.

## Solução Implementada

### 1. Criado `PrismaModule` Global

**Arquivo**: `/src/@core/infra/database/prisma.module.ts`

```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

O decorator `@Global()` garante que o módulo seja **singleton** em toda a aplicação.

### ✅ Configuração do Pool de Conexões

**Arquivo**: `src/@core/infra/database/prisma.service.ts`

```typescript
constructor() {
  super({
    datasources: {
      db: {
        url: process.env.DATABASE_LINK, // ✅ Sem parâmetros adicionais
      },
    },
    log: ['error', 'warn'],
  });
}
```

**Configure no `.env`**:
```env
DATABASE_LINK="postgresql://user:password@host:5432/database?connection_limit=5&pool_timeout=20"
```

**Parâmetros recomendados**:
- `connection_limit=5`: Máximo de 5 conexões simultâneas
- `pool_timeout=20`: Timeout de 20 segundos para adquirir conexão

**⚠️ ERRO ANTERIOR**: Adicionar parâmetros via código (`url: ${process.env.DATABASE_LINK}?connection_limit=5`) causava erro:
```
The table `public?connection_limit=5.company` does not exist
```
Prisma interpretava os parâmetros como parte do schema, não como query parameters.

### 3. Atualizado AppModule

**Antes**:
```typescript
@Module({
  imports: [CompaniesModule, ...],
  providers: [PrismaService, ...], // ❌ Criava instância local
})
```

**Depois**:
```typescript
@Module({
  imports: [PrismaModule, CompaniesModule, ...], // ✅ Importa módulo global
  providers: [AppService, ...], // ✅ Sem PrismaService
})
```

### 4. Removido PrismaService dos Módulos Filhos

**Módulos Atualizados**:
- ✅ `CompaniesModule`
- ✅ `SendMessageWhatsappModule`

Agora eles **injetam** o `PrismaService` do módulo global em vez de criar suas próprias instâncias.

## Benefícios

1. **Uma única instância** do Prisma Client em toda a aplicação
2. **Pool de conexões controlado** (máximo 5 conexões)
3. **Reutilização de conexões** entre requisições
4. **Prevenção de vazamento** de conexões
5. **Performance melhorada** (menos overhead de criação de conexões)

## Como Testar

1. Reinicie a aplicação:
   ```bash
   npm start
   ```

2. Execute múltiplas requisições simultâneas (ex: `test-fluxo.html`)

3. Verifique os logs - **NÃO** deve mais aparecer:
   ```
   Too many database connections opened
   ```

## Monitoramento

Para verificar conexões ativas no PostgreSQL:

```sql
SELECT 
  count(*) as total_connections,
  datname,
  usename,
  application_name
FROM pg_stat_activity
WHERE datname = 'seu_banco'
GROUP BY datname, usename, application_name;
```

**Esperado**: Máximo de 5-6 conexões da api_oficial

## Referências

- [NestJS Global Modules](https://docs.nestjs.com/modules#global-modules)
- [Prisma Connection Pool](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Connection Limits](https://www.postgresql.org/docs/current/runtime-config-connection.html)

---

**Status**: ✅ CORRIGIDO - Pool de conexões agora é gerenciado corretamente
**Data**: 2025-12-17
