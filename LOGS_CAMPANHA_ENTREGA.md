# 🔍 Guia de Logs - Rastreamento de Entrega de Campanhas API Oficial

## 📋 Resumo do Problema

Mensagens de campanha aparecem como **enviadas** mas não como **entregues** na API Oficial.

## 🎯 Logs Implementados

### 1. Backend - Disparo de Campanha (`queues.ts`)

#### Logs de Início
```
[CAMPAIGN-DISPATCH] 📤 Disparo solicitado: Campanha=X, Registro=Y, Canal=whatsapp_oficial, Status=EM_ANDAMENTO
```

#### Logs de Template
```
[CAMPAIGN-DISPATCH] 📋 Enviando template da Meta: Campanha=X, Template=Y, Ticket=Z, Contato=5511999999999
[CAMPAIGN-DISPATCH] 🚀 Chamando SendWhatsAppOficialMessage - Ticket=Z, Template=nome_template
```

#### Logs de Sucesso
```
[CAMPAIGN-DISPATCH] ✅ Template enviado com sucesso - Ticket=Z, MessageId=wamid.XXX
[CAMPAIGN-DISPATCH] 📝 CampaignShipping atualizado com deliveredAt - ID=Y, Time=2024-12-11 20:50:00
```

### 2. Backend - Envio via API Oficial (`SendWhatsAppOficialMessage.ts`)

```
[WHATSAPP OFICIAL - SEND] ✅ Mensagem enviada via API - Ticket: Z
[WHATSAPP OFICIAL - SAVE] Salvando mensagem no banco - Ticket: Z
[WHATSAPP OFICIAL - SAVE] ✅ Mensagem salva com sucesso - Ticket: Z
```

**⚠️ Log Crítico:**
```
[WHATSAPP OFICIAL - SAVE] ❌ CRÍTICO: Mensagem enviada mas NÃO foi salva - Ticket: Z, WID: wamid.XXX
```

### 3. API Oficial - Webhook de Status (`webhook.service.ts`)

#### Logs de Status Recebidos
```
[WEBHOOK STATUS] 📬 Processando 1 status updates
[WEBHOOK STATUS] 📨 MessageId: wamid.XXX, Status: sent, Timestamp: 1702329000, Recipient: 5511999999999
[WEBHOOK STATUS] 🚀 SENT - Mensagem wamid.XXX foi ENVIADA (aguardando entrega)
```

#### Logs de Entrega Confirmada
```
[WEBHOOK STATUS] 📨 MessageId: wamid.XXX, Status: delivered, Timestamp: 1702329010, Recipient: 5511999999999
[WEBHOOK STATUS] ✅ DELIVERED - Mensagem wamid.XXX foi ENTREGUE ao destinatário
```

#### Logs de Leitura
```
[WEBHOOK STATUS] 📨 MessageId: wamid.XXX, Status: read, Timestamp: 1702329020, Recipient: 5511999999999
[WEBHOOK STATUS] 👀 READ - Mensagem wamid.XXX foi LIDA pelo destinatário
```

#### Logs de Falha
```
[WEBHOOK STATUS] 📨 MessageId: wamid.XXX, Status: failed, Timestamp: 1702329000, Recipient: 5511999999999
[WEBHOOK STATUS] ❌ FAILED - Mensagem wamid.XXX FALHOU: {"code":131051,"title":"Re-engagement message"}
```

## 🔎 Como Visualizar os Logs

### Backend (Node.js)
```bash
# Ver logs em tempo real
pm2 logs backend --lines 200

# Filtrar apenas logs de campanha
pm2 logs backend --lines 500 | grep "CAMPAIGN-DISPATCH"

# Filtrar logs de envio oficial
pm2 logs backend --lines 500 | grep "WHATSAPP OFICIAL"

# Ver logs de uma campanha específica
pm2 logs backend --lines 1000 | grep "Campanha=18"
```

### API Oficial (NestJS)
```bash
# Ver logs em tempo real
pm2 logs api-oficial --lines 200

# Filtrar apenas status de entrega
pm2 logs api-oficial --lines 500 | grep "WEBHOOK STATUS"

# Ver apenas mensagens entregues
pm2 logs api-oficial --lines 500 | grep "DELIVERED"

# Ver apenas falhas
pm2 logs api-oficial --lines 500 | grep "FAILED"
```

### Logs Combinados (Backend + API Oficial)
```bash
# Ver tudo junto
pm2 logs --lines 500

# Salvar logs em arquivo
pm2 logs backend --lines 2000 > logs_backend.txt
pm2 logs api-oficial --lines 2000 > logs_api_oficial.txt
```

## 📊 Fluxo Completo de Rastreamento

### 1️⃣ Disparo da Campanha
```
[CAMPAIGN-DISPATCH] 📤 Disparo solicitado: Campanha=18, Registro=1234
[CAMPAIGN-DISPATCH] 📋 Enviando template: Template=860344899850824
[CAMPAIGN-DISPATCH] 🚀 Chamando SendWhatsAppOficialMessage
```

### 2️⃣ Envio via API Meta
```
[WHATSAPP OFICIAL - SEND] ✅ Mensagem enviada via API
[WHATSAPP OFICIAL - SAVE] ✅ Mensagem salva com sucesso
```

### 3️⃣ Atualização do CampaignShipping
```
[CAMPAIGN-DISPATCH] 📝 CampaignShipping atualizado com deliveredAt
```

### 4️⃣ Webhook de Status (API Oficial recebe)
```
[WEBHOOK STATUS] 📨 MessageId: wamid.XXX, Status: sent
[WEBHOOK STATUS] 🚀 SENT - Mensagem foi ENVIADA
```

### 5️⃣ Confirmação de Entrega (alguns segundos depois)
```
[WEBHOOK STATUS] 📨 MessageId: wamid.XXX, Status: delivered
[WEBHOOK STATUS] ✅ DELIVERED - Mensagem foi ENTREGUE
```

## 🚨 Problemas Comuns e Como Identificar

### Problema 1: Mensagem não é enviada
**Sintoma:** Não aparece log `[CAMPAIGN-DISPATCH] 🚀 Chamando SendWhatsAppOficialMessage`

**Possíveis causas:**
- Campanha não está com status `EM_ANDAMENTO`
- Template não encontrado
- Erro antes do envio

**Como verificar:**
```bash
pm2 logs backend | grep "CAMPAIGN-DISPATCH" | grep "Campanha=18"
```

### Problema 2: Mensagem enviada mas não salva
**Sintoma:** Aparece log `[WHATSAPP OFICIAL - SEND] ✅` mas não aparece `[WHATSAPP OFICIAL - SAVE] ✅`

**Possíveis causas:**
- Erro ao salvar no banco de dados
- Problema de concorrência
- Timeout

**Como verificar:**
```bash
pm2 logs backend | grep "WHATSAPP OFICIAL - SAVE" | grep "CRÍTICO"
```

### Problema 3: Webhook não recebe status
**Sintoma:** Não aparece log `[WEBHOOK STATUS]` após envio

**Possíveis causas:**
- Webhook não configurado corretamente na Meta
- URL do webhook incorreta
- Firewall bloqueando requisições da Meta

**Como verificar:**
```bash
# Verificar se webhook está recebendo ALGO
pm2 logs api-oficial | grep "WEBHOOK START"

# Verificar se está recebendo status
pm2 logs api-oficial | grep "WEBHOOK STATUS"
```

### Problema 4: Status "sent" mas nunca "delivered"
**Sintoma:** Aparece `SENT` mas nunca aparece `DELIVERED`

**Possíveis causas:**
- Número do destinatário não existe
- Destinatário bloqueou o número
- Problema na rede do destinatário
- Template rejeitado pela Meta

**Como verificar:**
```bash
# Ver todos os status de uma mensagem específica
pm2 logs api-oficial | grep "wamid.XXX"
```

## 📝 Exemplo de Sequência Normal

```
# Backend - Disparo
20:50:00 [CAMPAIGN-DISPATCH] 📤 Disparo solicitado: Campanha=18, Registro=1234
20:50:00 [CAMPAIGN-DISPATCH] 📋 Enviando template: Template=860344899850824
20:50:00 [CAMPAIGN-DISPATCH] 🚀 Chamando SendWhatsAppOficialMessage
20:50:01 [WHATSAPP OFICIAL - SEND] ✅ Mensagem enviada via API
20:50:01 [WHATSAPP OFICIAL - SAVE] ✅ Mensagem salva com sucesso
20:50:01 [CAMPAIGN-DISPATCH] ✅ Template enviado - MessageId=wamid.ABC123
20:50:01 [CAMPAIGN-DISPATCH] 📝 CampaignShipping atualizado com deliveredAt

# API Oficial - Webhook
20:50:02 [WEBHOOK STATUS] 📨 MessageId: wamid.ABC123, Status: sent
20:50:02 [WEBHOOK STATUS] 🚀 SENT - Mensagem foi ENVIADA
20:50:05 [WEBHOOK STATUS] 📨 MessageId: wamid.ABC123, Status: delivered
20:50:05 [WEBHOOK STATUS] ✅ DELIVERED - Mensagem foi ENTREGUE
20:50:30 [WEBHOOK STATUS] 📨 MessageId: wamid.ABC123, Status: read
20:50:30 [WEBHOOK STATUS] 👀 READ - Mensagem foi LIDA
```

## 🛠️ Comandos Úteis para Diagnóstico

### Rastrear uma campanha específica do início ao fim
```bash
# Pegar ID da campanha e timestamp aproximado
CAMPAIGN_ID=18
TIME="20:50"

# Ver todos os logs relacionados
pm2 logs backend --lines 2000 | grep -E "(Campanha=${CAMPAIGN_ID}|${TIME})"
pm2 logs api-oficial --lines 2000 | grep "${TIME}"
```

### Contar quantas mensagens foram enviadas vs entregues
```bash
# Enviadas
pm2 logs backend --lines 5000 | grep "Template enviado com sucesso" | wc -l

# Entregues (webhook recebeu)
pm2 logs api-oficial --lines 5000 | grep "DELIVERED" | wc -l
```

### Ver erros recentes
```bash
pm2 logs backend --lines 500 --err
pm2 logs api-oficial --lines 500 --err
```

## 📌 Próximos Passos

1. **Executar campanha de teste** com 1-2 contatos
2. **Monitorar logs em tempo real** durante o disparo
3. **Identificar em qual etapa** o processo está falhando
4. **Compartilhar logs específicos** para análise mais detalhada

## 🔗 Arquivos Modificados

- `/backend/src/queues.ts` - Logs de disparo de campanha
- `/backend/src/services/WhatsAppOficial/SendWhatsAppOficialMessage.ts` - Logs de envio
- `/api_oficial/src/resources/v1/webhook/webhook.service.ts` - Logs de status
