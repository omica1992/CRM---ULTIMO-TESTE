# 🔧 Como Configurar Meta API para Templates com Mídia

## ❌ Problema Atual

Os logs mostram:
```
[UPLOAD MEDIA] Access Token: NÃO FORNECIDO
[UPLOAD MEDIA] WABA ID: NÃO FORNECIDO
```

Isso significa que a conexão WhatsApp **não tem** os campos `tokenMeta` (ou `send_token`) e `waba_id` configurados.

## ✅ Atualização: Sistema Usa Fallback

O sistema agora verifica **dois campos** para o Access Token:
1. **Primeiro**: `tokenMeta` (preferencial)
2. **Fallback**: `send_token` (se tokenMeta estiver vazio)

Portanto, se você já tem `send_token` preenchido, **não precisa fazer nada**! O sistema usará automaticamente.

---

## ✅ Solução: Configurar Campos no Banco de Dados

### 1. Identificar o ID da Conexão

Verifique qual conexão WhatsApp você está usando para criar templates. No seu caso, parece ser a conexão com `token: CCK8EnoEm9bqUPiceBmIjQaQc7H1RH`.

### 2. Obter Credenciais da Meta

Você precisa de 2 informações da Meta/Facebook:

#### A. Access Token (tokenMeta)
1. Acesse o [Meta Business Suite](https://business.facebook.com/)
2. Vá em **Configurações** → **Configurações do Sistema**
3. Clique em **Tokens de Acesso**
4. Copie o **Access Token** (começa com `EAA...`)

#### B. WhatsApp Business Account ID (waba_id)
1. No Meta Business Suite, vá em **Configurações do WhatsApp**
2. Procure por **ID da Conta do WhatsApp Business**
3. Copie o número (ex: `123456789012345`)

### 3. Atualizar no Banco de Dados

#### Opção 1: Via SQL Direto

```sql
-- Substituir os valores pelos seus dados reais
UPDATE "Whatsapps" 
SET 
  "tokenMeta" = 'EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',  -- Seu Access Token
  "waba_id" = '123456789012345'                      -- Seu WABA ID
WHERE "id" = 1;  -- ID da sua conexão WhatsApp
```

#### Opção 2: Via Interface (se houver)

Se o sistema tiver uma interface de edição de conexões:
1. Vá em **Conexões** → **Editar Conexão**
2. Procure pelos campos:
   - **Token Meta** ou **Access Token**
   - **WABA ID** ou **WhatsApp Business Account ID**
3. Preencha e salve

---

## 🔍 Como Verificar se Funcionou

### 1. Verificar no Banco de Dados

```sql
SELECT 
  id,
  name,
  CASE 
    WHEN "tokenMeta" IS NOT NULL AND "tokenMeta" != '' 
    THEN CONCAT(LEFT("tokenMeta", 20), '...')
    ELSE 'NÃO CONFIGURADO'
  END as token_meta_status,
  CASE 
    WHEN "waba_id" IS NOT NULL AND "waba_id" != '' 
    THEN "waba_id"
    ELSE 'NÃO CONFIGURADO'
  END as waba_id_status,
  provider,
  channel
FROM "Whatsapps"
WHERE id = 1;  -- Seu ID
```

### 2. Verificar nos Logs do Frontend

Após configurar, faça upload de uma imagem novamente e verifique os logs:

```javascript
// ✅ DEVE APARECER:
[TEMPLATE MODAL] 📋 Dados da conexão: {
  hasTokenMeta: true,
  hasWabaId: true,
  tokenMeta: 'EAAxxxxxxxxxxxxx...',
  waba_id: '123456789012345',
  provider: 'oficial',
  channel: 'whatsapp_oficial'
}
[TEMPLATE MODAL] 🚀 Upload para Meta API habilitado
```

### 3. Verificar nos Logs do Backend

```
// ✅ DEVE APARECER:
[UPLOAD MEDIA] Upload to Meta: SIM
[UPLOAD MEDIA] Access Token: EAAxxxxxxxxxxxxx...
[UPLOAD MEDIA] WABA ID: 123456789012345
[UPLOAD TO META] 📤 Iniciando upload para Meta API
[UPLOAD TO META] ✅ Sessão criada com sucesso
[UPLOAD TO META] 🎉 Handle gerado: 4:xxxxx
[UPLOAD MEDIA] 🎯 Meta Handle gerado: 4:xxxxx
```

### 4. Verificar no Template

```
// ✅ DEVE APARECER:
[CREATE TEMPLATE] ✅ HEADER com Meta Handle (CORRETO): 4:xxxxx
```

---

## 🚨 Troubleshooting

### Erro: "Access Token: NÃO FORNECIDO"

**Causa**: Campo `tokenMeta` está vazio ou NULL no banco.

**Solução**: Execute o UPDATE SQL acima com o Access Token correto.

### Erro: "WABA ID: NÃO FORNECIDO"

**Causa**: Campo `waba_id` está vazio ou NULL no banco.

**Solução**: Execute o UPDATE SQL acima com o WABA ID correto.

### Erro: "URL da mídia deve usar HTTPS"

**Causa**: Upload para Meta não está funcionando, sistema está usando URL local.

**Solução**: Verifique se `tokenMeta` e `waba_id` estão corretos.

### Como Testar o Access Token

```bash
# Teste se o token está válido
curl -X GET "https://graph.facebook.com/v18.0/me?access_token=SEU_TOKEN_AQUI"

# Deve retornar algo como:
{
  "id": "123456789012345",
  "name": "Sua Empresa"
}
```

---

## 📋 Checklist

- [ ] Obtive o Access Token da Meta
- [ ] Obtive o WABA ID da Meta
- [ ] Atualizei o campo `tokenMeta` no banco
- [ ] Atualizei o campo `waba_id` no banco
- [ ] Verifiquei que os campos estão salvos corretamente
- [ ] Testei upload de imagem
- [ ] Logs mostram "Upload para Meta API habilitado"
- [ ] Logs mostram "Meta Handle gerado"
- [ ] Template foi criado com sucesso

---

## 🎯 Resultado Esperado

Após configurar corretamente, o fluxo será:

1. **Upload de Imagem** → Envia para Meta API
2. **Meta API** → Retorna handle: `4:xxxxx`
3. **Template** → Usa handle em vez de URL
4. **Meta** → Aprova template ✅

**Antes (ERRADO)**:
```json
{
  "header_handle": ["http://localhost:8080/public/..."]
}
```

**Depois (CORRETO)**:
```json
{
  "header_handle": ["4:aW1hZ2VuX2hhc2g="]
}
```

---

## 📚 Referências

- [Meta Business Suite](https://business.facebook.com/)
- [WhatsApp Cloud API - Resumable Upload](https://developers.facebook.com/docs/graph-api/guides/upload)
- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp)

---

**Data**: 12/12/2024  
**Versão**: 1.0.0
