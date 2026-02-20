# 🐛 Correção: Duplicação por CreateMessageService

**Data**: 11/12/2025  
**Problema**: Mensagens de fallback e saída sendo duplicadas na API Oficial, mas apenas **uma** sendo enviada via API

---

## 📋 Análise do Problema

### **Sintoma**:
- ✅ Apenas **1 chamada** à API do WhatsApp (correto)
- ❌ **2 mensagens** aparecem no banco de dados
- ❌ **2 mensagens** exibidas no frontend

### **Evidência nos Logs**:
```
[MENU NODE] Opção inválida: "3". Enviando mensagem de fallback.
📋 [WHATSAPP-OFICIAL] Enviando mensagem: { "body": "Opção inválida..." }
[CREATE MESSAGE] ➕ Nova mensagem criada wamid.HBgN...  ← VIA API (CORRETO)
[CREATE MESSAGE] ➕ Nova mensagem criada k8CmqipA...  ← VIA CreateMessageService (DUPLICADO!)
```

---

## 🔍 Causa Raiz

### **Diferença entre Baileys e API Oficial**:

#### **Baileys**:
```typescript
await SendWhatsAppMessage({ body, ticket });  // ❌ NÃO salva no banco
await CreateMessageService({ messageData });  // ✅ Precisa salvar manualmente
```

#### **API Oficial**:
```typescript
await SendWhatsAppOficialMessage({ body, ticket });  // ✅ JÁ salva no banco automaticamente
await CreateMessageService({ messageData });         // ❌ DUPLICA a mensagem!
```

### **Problema no ActionsWebhookService.ts**:

O código estava tratando **ambos os canais da mesma forma**:

```typescript
// ❌ ANTES (PROBLEMÁTICO)
if (whatsapp.channel === "whatsapp") {
  await SendWhatsAppMessage({ body, ticket });
} else if (whatsapp.channel === "whatsapp_oficial") {
  await SendWhatsAppOficialMessage({ body, ticket });
}

// ❌ Salva para AMBOS os canais (duplica na API Oficial!)
const messageData = { wid, ticketId, body, fromMe: true };
await CreateMessageService({ messageData, companyId });
```

---

## ✅ Solução Implementada

### **Estratégia**: Salvar Apenas para Baileys

Mover o `CreateMessageService` para **dentro** do bloco do Baileys, evitando duplicação na API Oficial.

### **Correção 1: Mensagem de Fallback (Opção Inválida)**

**Arquivo**: `ActionsWebhookService.ts` (linhas 1590-1617)

**Antes**:
```typescript
if (whatsapp.channel === "whatsapp") {
  await SendWhatsAppMessage({ body: fallbackMessage, ticket });
} else if (whatsapp.channel === "whatsapp_oficial") {
  await SendWhatsAppOficialMessage({ body: fallbackMessage, ticket });
}

// ❌ Salva para AMBOS
const messageData = { wid, ticketId, body: fallbackMessage, fromMe: true };
await CreateMessageService({ messageData, companyId });
```

**Depois**:
```typescript
if (whatsapp.channel === "whatsapp") {
  await SendWhatsAppMessage({ body: fallbackMessage, ticket });
  
  // ✅ Baileys: Salvar mensagem manualmente
  const messageData = { wid, ticketId, body: fallbackMessage, fromMe: true };
  await CreateMessageService({ messageData, companyId });
  
} else if (whatsapp.channel === "whatsapp_oficial") {
  // ✅ API Oficial: SendWhatsAppOficialMessage já salva automaticamente
  await SendWhatsAppOficialMessage({ body: fallbackMessage, ticket });
  // ✅ NÃO chamar CreateMessageService - evita duplicação!
}
```

---

### **Correção 2: Mensagem de Saída (Sair)**

**Arquivo**: `ActionsWebhookService.ts` (linhas 1525-1552)

**Antes**:
```typescript
if (whatsapp.channel === "whatsapp") {
  await SendWhatsAppMessage({ body: exitMessage, ticket });
} else if (whatsapp.channel === "whatsapp_oficial") {
  await SendWhatsAppOficialMessage({ body: exitMessage, ticket });
}

// ❌ Salva para AMBOS
const messageData = { wid, ticketId, body: exitMessage, fromMe: true };
await CreateMessageService({ messageData, companyId });
```

**Depois**:
```typescript
if (whatsapp.channel === "whatsapp") {
  await SendWhatsAppMessage({ body: exitMessage, ticket });
  
  // ✅ Baileys: Salvar mensagem manualmente
  const messageData = { wid, ticketId, body: exitMessage, fromMe: true };
  await CreateMessageService({ messageData, companyId });
  
} else if (whatsapp.channel === "whatsapp_oficial") {
  // ✅ API Oficial: SendWhatsAppOficialMessage já salva automaticamente
  await SendWhatsAppOficialMessage({ body: exitMessage, ticket });
  // ✅ NÃO chamar CreateMessageService - evita duplicação!
}
```

---

## 🎯 Como Funciona

### **Fluxo Antes (Problemático)**:
```
1. SendWhatsAppOficialMessage envia mensagem
2. SendWhatsAppOficialMessage salva no banco (wamid.HBgN...)  ✅
3. CreateMessageService salva NOVAMENTE (k8CmqipA...)  ❌ DUPLICADO
4. Resultado: 2 mensagens no banco
```

### **Fluxo Depois (Correto)**:
```
1. SendWhatsAppOficialMessage envia mensagem
2. SendWhatsAppOficialMessage salva no banco (wamid.HBgN...)  ✅
3. CreateMessageService NÃO é chamado  ✅
4. Resultado: 1 mensagem no banco  ✅
```

---

## 📊 Comparação

### **Baileys**:
| Passo | Ação | Salva no Banco? |
|-------|------|-----------------|
| 1 | `SendWhatsAppMessage` | ❌ Não |
| 2 | `CreateMessageService` | ✅ Sim (necessário) |

### **API Oficial**:
| Passo | Ação | Salva no Banco? |
|-------|------|-----------------|
| 1 | `SendWhatsAppOficialMessage` | ✅ Sim (automático) |
| 2 | `CreateMessageService` | ❌ Não (duplicaria!) |

---

## 📝 Arquivos Modificados

1. **`/backend/src/services/WebhookService/ActionsWebhookService.ts`**
   - Linha 1590-1617: Correção de fallback (opção inválida)
   - Linha 1525-1552: Correção de mensagem de saída (Sair)

---

## ✅ Resultado Final

### **Antes**:
- ❌ 2 mensagens no banco de dados
- ❌ 2 mensagens exibidas no frontend
- ❌ 1 com `wid` da API, 1 com `wid` aleatório

### **Depois**:
- ✅ **1 mensagem no banco de dados**
- ✅ **1 mensagem exibida no frontend**
- ✅ Apenas `wid` da API (correto)

---

## 🎯 Impacto

- ✅ **Elimina duplicação** de mensagens na API Oficial
- ✅ **Mantém compatibilidade** com Baileys
- ✅ **Banco de dados limpo** sem registros duplicados
- ✅ **UX correta** - usuário vê apenas 1 mensagem

---

## 🔍 Verificação

### **Como Identificar o Problema**:
```sql
-- Verificar mensagens duplicadas
SELECT body, COUNT(*) as count
FROM Messages
WHERE ticketId = 146 AND fromMe = true
GROUP BY body
HAVING COUNT(*) > 1;
```

### **Logs Esperados Após Correção**:
```
[MENU NODE] Opção inválida: "3". Enviando mensagem de fallback.
📋 [WHATSAPP-OFICIAL] Enviando mensagem: { "body": "Opção inválida..." }
[CREATE MESSAGE] ➕ Nova mensagem criada wamid.HBgN...  ✅ ÚNICA
[WHATSAPP OFICIAL - SEND] ✅ Mensagem enviada via API - Ticket: 146
[WHATSAPP OFICIAL - SAVE] ✅ Mensagem salva com sucesso - Ticket: 146
```

**Sem** o segundo `[CREATE MESSAGE]` com `wid` aleatório!

---

**Status**: ✅ CORREÇÃO APLICADA - Duplicação por CreateMessageService eliminada!
