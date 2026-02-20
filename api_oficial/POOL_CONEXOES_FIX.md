# ✅ Correção: Pool de Conexões PostgreSQL (P2037)

## Problema
Erro **"Too many database connections opened"** ao iniciar a `api_oficial`.

## Causa
Múltiplas instâncias da aplicação ou conexões não fechadas esgotaram o pool do PostgreSQL.

## Correções Aplicadas

### 1. Schema Prisma (`prisma/schema.prisma`)
- Adicionado `relationMode = "prisma"` para melhor gerenciamento de conexões

### 2. PrismaService (`src/@core/infra/database/prisma.service.ts`)
- Adicionado constructor com configuração explícita de datasource
- Configurado log apenas para erros e warnings

### 3. Connection String (DATABASE_LINK no .env)

**IMPORTANTE**: Adicione parâmetros de pool na sua connection string:

```env
# ❌ ANTES (sem limites)
DATABASE_LINK=postgresql://user:password@localhost:5432/database

# ✅ DEPOIS (com limites)
DATABASE_LINK=postgresql://user:password@localhost:5432/database?connection_limit=10&pool_timeout=20
```

**Parâmetros**:
- `connection_limit=10`: Máximo de 10 conexões simultâneas por instância
- `pool_timeout=20`: Aguarda até 20 segundos por uma conexão disponível

### 4. Ajustar PostgreSQL (se necessário)

Se o erro persistir, aumente o limite global do PostgreSQL:

```sql
-- Verificar limite atual
SHOW max_connections;

-- Aumentar para 100 (requer restart do PostgreSQL)
ALTER SYSTEM SET max_connections = 100;
```

Depois reinicie o PostgreSQL:
```bash
# Windows (como admin)
net stop postgresql-x64-14
net start postgresql-x64-14

# Linux
sudo systemctl restart postgresql
```

## Passos para Resolver

1. **Matar processos Node.js**:
```powershell
Stop-Process -Name node -Force
```

2. **Atualizar .env** com connection_limit (veja acima)

3. **Regenerar Prisma Client**:
```bash
cd api_oficial
npx prisma generate
```

4. **Iniciar apenas UMA instância**:
```bash
npm start
```

## Verificar Conexões Ativas

```sql
-- Ver conexões ativas
SELECT count(*) FROM pg_stat_activity;

-- Ver conexões por database
SELECT datname, count(*) 
FROM pg_stat_activity 
GROUP BY datname;

-- Matar conexões idle (se necessário)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND datname = 'seu_database';
```

## Prevenção

- ✅ Nunca rode múltiplas instâncias da api_oficial simultaneamente
- ✅ Use PM2 com `instances: 1` ou cluster mode desabilitado
- ✅ Sempre use `connection_limit` na connection string
- ✅ Monitore conexões ativas no PostgreSQL

## Status
✅ Correções aplicadas no código
⚠️ **AÇÃO NECESSÁRIA**: Atualizar `.env` com `connection_limit`
