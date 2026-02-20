# 🔴 ERRO CRÍTICO: Template ID Integer Overflow

## 📋 Problema Identificado

**Erro**: `o valor "3806438242983138" está fora do intervalo para o tipo de dados integer`

### Causa Raiz

O `templateId` retornado pela API Meta do WhatsApp é um número muito grande:
- **Template ID da Meta**: `3806438242983138`
- **Limite do INTEGER PostgreSQL**: `2.147.483.647`
- **Resultado**: ❌ Overflow - valor não cabe no tipo INTEGER

### Onde Ocorre

```
INFO [12-11-2025 21:48:19]: [CAMPAIGN-DISPATCH] 📍 Enviando template SEM ticket: 
  Campanha=20, Template=3806438242983138, Contato=5512997363619

SequelizeDatabaseError: o valor "3806438242983138" está fora do intervalo 
para o tipo de dados integer
```

---

## ✅ Solução

### 1. Verificar Tipo Atual da Coluna

Execute no PostgreSQL:

```sql
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'Campaigns' 
  AND column_name = 'templateId';
```

**Se retornar `integer`**, precisa corrigir.

### 2. Corrigir Tipo da Coluna

**Opção A: Via SQL Direto** (Recomendado - Mais Rápido)

Execute o arquivo `FIX_TEMPLATEID_TYPE.sql`:

```bash
psql -U seu_usuario -d seu_banco -f FIX_TEMPLATEID_TYPE.sql
```

Ou execute manualmente:

```sql
ALTER TABLE "Campaigns" 
ALTER COLUMN "templateId" TYPE VARCHAR(255) 
USING "templateId"::VARCHAR;
```

**Opção B: Via Migration** (Se preferir manter histórico)

A migration já existe em:
`/backend/src/database/migrations/20251118191400-add-template-meta-fields-to-campaigns.ts`

Mas pode ter falhado silenciosamente. Force a execução:

```bash
cd backend
npm run db:migrate
```

### 3. Reiniciar Backend

Após corrigir o banco:

```bash
pm2 restart backend
```

### 4. Testar Campanha Novamente

1. Crie uma nova campanha com template Meta
2. Verifique os logs - deve aparecer:

```
INFO [CAMPAIGN-DISPATCH] ✅ Template enviado com sucesso - 
  Ticket=X, MessageId=wamid.xxxxx
```

---

## 🔍 Verificação

### Confirmar que a coluna foi alterada:

```sql
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'Campaigns' 
  AND column_name = 'templateId';
```

**Resultado Esperado**:
```
column_name  | data_type          | character_maximum_length
templateId   | character varying  | 255
```

### Testar inserção de valor grande:

```sql
-- Teste simples (não execute se tiver dados reais)
UPDATE "Campaigns" 
SET "templateId" = '3806438242983138' 
WHERE id = 20;
```

Se não der erro, está corrigido! ✅

---

## 📊 Impacto

### Antes da Correção
- ❌ Todas as campanhas com templates Meta falham
- ❌ Erro: `integer overflow`
- ❌ 0 mensagens enviadas

### Depois da Correção
- ✅ Campanhas com templates Meta funcionam
- ✅ Template ID armazenado corretamente
- ✅ Mensagens enviadas com sucesso

---

## 🎯 Resumo Executivo

| Item | Status |
|------|--------|
| **Problema** | Template ID muito grande para INTEGER |
| **Solução** | Alterar coluna para VARCHAR(255) |
| **Arquivo SQL** | `FIX_TEMPLATEID_TYPE.sql` |
| **Tempo de Fix** | ~30 segundos |
| **Downtime** | Nenhum (ALTER TABLE é rápido) |
| **Risco** | Baixo (apenas altera tipo de dados) |

---

## 🚀 Próximos Passos

1. ✅ Execute o SQL de correção
2. ✅ Reinicie o backend
3. ✅ Teste uma campanha
4. ✅ Monitore os logs para confirmar sucesso

**Após a correção, as campanhas com templates Meta devem funcionar perfeitamente!**
