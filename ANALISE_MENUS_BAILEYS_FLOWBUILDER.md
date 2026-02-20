# 🔍 ANÁLISE - Por Que Menus Quebram no FlowBuilder (Baileys)

## ❌ **PROBLEMA REAL**

**Sintoma**: Menus (botões e listas) FUNCIONAM na API Oficial, mas QUEBRAM em conexões Baileys quando usados no FlowBuilder.

**Relato do Usuário**: "menus quebram o fluxo em conexões baileys, porém em conexões api oficial funcionam normalmente"

---

## 🔍 **INVESTIGAÇÃO DO FLUXO - Baileys**

### **1. Como a Mensagem de Menu Chega no Baileys**

Quando o cliente clica em um botão ou seleciona uma opção de lista, o WhatsApp envia uma mensagem com estrutura específica:

```typescript
msg = {
  key: {
    fromMe: false,
    remoteJid: "5511999999999@s.whatsapp.net",
    id: "3EB0XXXX"
  },
  message: {
    // Para botões
    buttonsResponseMessage: {
      selectedButtonId: "1",           // ID do botão clicado
      selectedDisplayText: "Opção 1"   // Texto exibido
    },
    // OU para listas
    listResponseMessage: {
      singleSelectReply: {
        selectedRowId: "opt1"           // ID da opção
      },
      title: "Opção Selecionada"       // Título
    }
  }
}
```

---

### **2. Fluxo de Processamento no FlowBuilder (Baileys)**

#### **Arquivo**: `wbotMessageListener.ts`

**Passo 1**: Mensagem chega em `flowbuilderIntegration` (linha 2512)
```typescript
export const flowbuilderIntegration = async (
  msg: proto.IWebMessageInfo | null,
  wbot: Session | null,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  contact: Contact,
  isFirstMsg?: Ticket,
  isTranfered?: boolean
) => {
  const body = msg ? getBodyMessage(msg) : ticket.lastMessage || "";  // ⚠️ EXTRAÇÃO DO CORPO
  // ...
}
```

**Passo 2**: Fluxo interrompido continua (linha 3014)
```typescript
} else if (ticket.flowStopped && ticket.lastFlowId) {
  // Fluxo interrompido
  console.log(`[FLOW STOPPED] Continuando fluxo interrompido ${ticket.flowStopped}`);
  
  const flow = await FlowBuilderModel.findOne({
    where: {
      id: ticket.flowStopped,
      company_id: companyId
    }
  });
  
  if (flow) {
    const nodes: INodes[] = flow.flow["nodes"];
    const connections: IConnections[] = flow.flow["connections"];
    
    await ActionsWebhookService(
      whatsapp.id,
      parseInt(ticket.flowStopped),
      ticket.companyId,
      nodes,
      connections,
      ticket.lastFlowId,
      null,
      "",
      "",
      body,  // ⚠️ CORPO EXTRAÍDO É PASSADO AQUI
      ticket.id,
      mountDataContact
    );
  }
}
```

---

### **3. Extração do Corpo da Mensagem - getBodyMessage**

#### **Arquivo**: `wbotMessageListener.ts` (linhas 283-372)

```typescript
export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    let type = getTypeMessage(msg);  // ⚠️ IDENTIFICAR TIPO DA MENSAGEM
    
    const types = {
      conversation: msg.message?.conversation,
      buttonsResponseMessage:
        msg.message?.buttonsResponseMessage?.selectedDisplayText,  // ✅ Extrai texto do botão
      listResponseMessage:
        msg.message?.listResponseMessage?.title ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,  // ✅ Extrai opção da lista
      // ... outros tipos
    };
    
    const objKey = Object.keys(types).find(key => key === type);
    
    if (!objKey) {
      logger.warn(`#### Nao achou o type 152: ${type}`);  // ⚠️ TIPO NÃO RECONHECIDO!
      return null;
    }
    
    return types[type];  // ⚠️ SE type ESTIVER ERRADO, RETORNA VALOR ERRADO
  } catch (error) {
    console.log(error);
  }
};
```

---

### **4. Identificação do Tipo - getTypeMessage**

#### **Arquivo**: `wbotMessageListener.ts` (linhas 220-229)

```typescript
const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  const msgType = getContentType(msg.message);  // ⚠️ USA FUNÇÃO DO BAILEYS
  
  if (msg.message?.extendedTextMessage && 
      msg.message?.extendedTextMessage?.contextInfo && 
      msg.message?.extendedTextMessage?.contextInfo?.externalAdReply) {
    return 'adMetaPreview';
  }
  
  if (msg.message?.viewOnceMessageV2) {
    return "viewOnceMessageV2";
  }
  
  return msgType;  // ⚠️ RETORNA O QUE getContentType RETORNAR
};
```

---

## 🎯 **POSSÍVEIS CAUSAS DO PROBLEMA**

### **Hipótese 1: getContentType não Reconhece Menus**

O `getContentType` vem do Baileys (`@whiskeysockets/baileys`) e pode não estar retornando o tipo correto para mensagens de menu.

**Teste**:
```typescript
// Adicionar log para verificar:
const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  const msgType = getContentType(msg.message);
  
  console.log("[DEBUG MENU] msgType retornado:", msgType);
  console.log("[DEBUG MENU] msg.message:", JSON.stringify(msg.message, null, 2));
  
  // ...resto do código
}
```

### **Hipótese 2: Estrutura da Mensagem Mudou**

O Baileys pode ter mudado a estrutura das mensagens de menu entre versões.

**Versão Atual**: `baileys@6.6.0` (downgrade aplicado anteriormente)

**Teste**:
```typescript
// Verificar se a estrutura está presente:
console.log("buttonsResponseMessage existe?", !!msg.message?.buttonsResponseMessage);
console.log("listResponseMessage existe?", !!msg.message?.listResponseMessage);
```

### **Hipótese 3: getBodyMessage Retorna undefined/null**

Se o tipo não for reconhecido, `getBodyMessage` pode retornar `null` ou `undefined`, e o FlowBuilder não consegue processar.

**Teste**:
```typescript
const body = msg ? getBodyMessage(msg) : ticket.lastMessage || "";

console.log("[DEBUG FLOW] Body extraído:", body);
console.log("[DEBUG FLOW] Body é null?", body === null);
console.log("[DEBUG FLOW] Body é undefined?", body === undefined);
```

---

## ✅ **SOLUÇÕES PROPOSTAS**

### **Solução 1: Fallback Manual para Menus**

Adicionar extração manual antes de usar `getBodyMessage`:

```typescript
// Em flowbuilderIntegration (linha 2523)
let body = "";

if (msg) {
  // ✅ CORREÇÃO: Tentar extrair resposta de menu MANUALMENTE primeiro
  const menuResponse = 
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message?.buttonsResponseMessage?.selectedDisplayText ||
    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.message?.listResponseMessage?.title;
  
  if (menuResponse) {
    body = menuResponse;
    console.log("[FLOW MENU] Resposta de menu detectada:", body);
  } else {
    body = getBodyMessage(msg);
  }
} else {
  body = ticket.lastMessage || "";
}
```

### **Solução 2: Adicionar Tipos de Menu em getTypeMessage**

Verificar explicitamente se é mensagem de menu:

```typescript
const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  // ✅ CORREÇÃO: Verificar menus ANTES de usar getContentType
  if (msg.message?.buttonsResponseMessage) {
    return "buttonsResponseMessage";
  }
  
  if (msg.message?.listResponseMessage) {
    return "listResponseMessage";
  }
  
  const msgType = getContentType(msg.message);
  
  if (msg.message?.extendedTextMessage && 
      msg.message?.extendedTextMessage?.contextInfo && 
      msg.message?.extendedTextMessage?.contextInfo?.externalAdReply) {
    return 'adMetaPreview';
  }
  
  if (msg.message?.viewOnceMessageV2) {
    return "viewOnceMessageV2";
  }
  
  return msgType;
};
```

### **Solução 3: Logs Detalhados para Diagnóstico**

Adicionar logs em pontos críticos:

```typescript
// Em getBodyMessage
export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    let type = getTypeMessage(msg);
    
    console.log("[GETBODY DEBUG] Tipo detectado:", type);
    console.log("[GETBODY DEBUG] Estrutura da mensagem:", {
      hasConversation: !!msg.message?.conversation,
      hasButtonsResponse: !!msg.message?.buttonsResponseMessage,
      hasListResponse: !!msg.message?.listResponseMessage,
      buttonsData: msg.message?.buttonsResponseMessage,
      listData: msg.message?.listResponseMessage
    });
    
    // ... resto do código
  }
}
```

---

## 🧪 **TESTES RECOMENDADOS**

### **Teste 1: Verificar Logs**
1. Criar FlowBuilder com menu de botões em Baileys
2. Cliente seleciona opção
3. Verificar logs do backend:
   ```bash
   pm2 logs backend --lines 200 | grep -E "GETBODY|FLOW MENU|FLOW STOPPED"
   ```

### **Teste 2: Comparar com API Oficial**
1. Mesmo fluxo em conexão API Oficial (funciona ✅)
2. Mesmo fluxo em conexão Baileys (quebra ❌)
3. Comparar estrutura das mensagens nos logs

### **Teste 3: Teste Manual de Extração**
```typescript
// No console do backend, testar:
const testMsg = {
  message: {
    buttonsResponseMessage: {
      selectedButtonId: "1",
      selectedDisplayText: "Opção 1"
    }
  }
};

const type = getContentType(testMsg.message);
console.log("Tipo retornado:", type);  // Deve ser "buttonsResponseMessage"
```

---

## 📊 **COMPARAÇÃO: API Oficial vs Baileys**

| Aspecto | API Oficial | Baileys |
|---------|-------------|---------|
| **Estrutura de Menu** | Padronizada (Meta API) | Depende do Baileys |
| **getContentType** | N/A (msg simulada) | Função do Baileys |
| **Extração Manual** | ✅ Feita | ❌ Não feita |
| **FlowBuilder** | ✅ Funciona | ❌ Quebra |

---

## 🎯 **PRÓXIMOS PASSOS**

1. ✅ **Adicionar logs detalhados** nas funções:
   - `getTypeMessage`
   - `getBodyMessage`
   - `flowbuilderIntegration`

2. ✅ **Testar com menu real** e capturar:
   - Estrutura completa da mensagem
   - Tipo retornado por `getContentType`
   - Valor extraído por `getBodyMessage`

3. ✅ **Implementar Solução 1 ou 2** baseado nos resultados dos testes

4. ✅ **Verificar versão do Baileys** e compatibilidade com menus

---

## 📁 **ARQUIVOS PARA MODIFICAR**

1. `/backend/src/services/WbotServices/wbotMessageListener.ts`
   - Função `getTypeMessage` (linha 220)
   - Função `getBodyMessage` (linha 283)
   - Função `flowbuilderIntegration` (linha 2512)

---

## ⚠️ **IMPORTANTE**

**NÃO REVERTER** as mudanças feitas na API Oficial - elas podem ter impacto positivo e não causam problemas.

**FOCO**: Corrigir extração de menu especificamente para **Baileys** no FlowBuilder.

---

**Status**: 🔍 **EM INVESTIGAÇÃO** - Aguardando logs e testes para identificar causa exata

**Data**: 16 de Dezembro de 2025
