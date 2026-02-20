# 🐛 Correção: Fluxo Morre ao Receber Resposta Inválida no Menu

**Data**: 11/12/2025  
**Problema**: Quando usuário envia resposta inválida em nó de menu, o fluxo envia mensagem de fallback mas depois morre com erro `Cannot read properties of undefined (reading 'arrayOption')`

---

## 📋 Análise do Problema

### **Fluxo do Erro**:

1. **Menu apresentado**: "Você é nosso cliente? [1] Sim [2] Não"
2. **Usuário responde**: "3" (opção inválida)
3. **Sistema detecta**: `[MENU NODE] Opção inválida: "3". Enviando mensagem de fallback.`
4. **Fallback enviado**: "Opção inválida. Por favor, escolha uma das opções..."
5. **Ticket atualizado**: `flowWebhook=true`, `lastFlowId=Mdl2Fv47G7lswfi6XUrdv8lSIuP1VD`
6. **Break executado**: Sai do loop mas mantém fluxo ativo
7. **❌ ERRO FATAL ao retomar**: 
   ```
   TypeError: Cannot read properties of undefined (reading 'arrayOption')
   Contexto: Ticket=144, nextStage=Mdl2Fv47G7lswfi6XUrdv8lSIuP1VD, nodeType=menu
   ```
8. **Estado resetado**: `flowWebhook=false`, fluxo morre
9. **Ticket travado**: Não responde mais a mensagens

---

## 🔍 Causa Raiz

### **Problema 1: Criação de `nodeSelected` Vazio**

**Localização**: `ActionsWebhookService.ts` linhas 434-438

**Código Problemático**:
```typescript
if (execFn === "") {
  console.log("UPDATE5...");
  nodeSelected = {
    type: "menu"  // ❌ Objeto sem 'data'!
  };
} else {
  console.log("UPDATE6...");
  nodeSelected = nodes.filter(node => node.id === execFn)[0];
}
```

**Por que falha**:
- Quando `execFn === ""` (resposta inválida), cria objeto `nodeSelected` **sem propriedade `data`**
- Depois, na linha 1573, tenta acessar `nodeSelected.data.arrayOption` → **ERRO!**

### **Problema 2: Falta de Verificação de Segurança**

**Localização**: `ActionsWebhookService.ts` linhas 1573 e 1646

**Código Problemático**:
```typescript
// Linha 1573 - Fallback de resposta inválida
nodeSelected.data.arrayOption.forEach(item => {  // ❌ Sem verificação!
  optionsText += `[${item.number}] ${item.value}\n`;
});

// Linha 1646 - Criação de menu
nodeSelected.data.arrayOption.map(item => {  // ❌ Sem verificação!
  optionsMenu += `[${item.number}] ${item.value}\n`;
});
```

**Por que falha**:
- Assume que `nodeSelected.data.arrayOption` sempre existe
- Se `nodeSelected` for criado vazio ou `data` não existir → **ERRO!**

---

## Correções Aplicadas

### **Correção 0**: Return em Vez de Break no Fallback

**Arquivo**: `ActionsWebhookService.ts` (linha 1630)

**Problema**: Após enviar fallback, o código fazia `break` em vez de `return`, permitindo que o fluxo continuasse e fosse reprocessado pelo `flowBuilderQueue` no `ReceivedWhatsApp.ts`, causando **duplicação da mensagem**.

**Antes**:
```typescript
logger.info(`[MENU NODE] Fallback enviado para ticket ${ticket.id}...`);

// Não fazer return - deixar o loop continuar naturalmente
// O ticket permanece em estado de aguardando resposta
break; // Permite reprocessamento!
```

**Depois**:
```typescript
logger.info(`[MENU NODE] Fallback enviado para ticket ${ticket.id}...`);

// CORREÇÃO: Retornar imediatamente para evitar duplicação
// O ticket permanece em estado de aguardando resposta
return "fallback_sent"; // Sai completamente para evitar reprocessamento
```

**Benefícios**:
- Evita duplicação de mensagem de fallback
- Impede reprocessamento desnecessário
- Ticket permanece aguardando resposta corretamente

---

### **Correção 1: Buscar Nó Completo em Vez de Criar Vazio**

**Arquivo**: `ActionsWebhookService.ts` (linhas 434-441)

**Antes**:
```typescript
if (execFn === "") {
  console.log("UPDATE5...");
  nodeSelected = {
    type: "menu"  // ❌ Objeto incompleto
  };
}
```

**Depois**:
```typescript
if (execFn === "") {
  console.log("UPDATE5...");
  // ✅ CORREÇÃO: Buscar o nó completo em vez de criar um objeto vazio
  nodeSelected = nodes.filter(node => node.id === next)[0];
  if (!nodeSelected) {
    logger.error(`[MENU NODE] Nó ${next} não encontrado após resposta inválida`);
    break;
  }
}
```

**Benefícios**:
- ✅ `nodeSelected` agora tem **todos os dados** do nó original
- ✅ `nodeSelected.data.arrayOption` existe e está completo
- ✅ Fallback pode ser recriado corretamente

---

### **Correção 2: Verificação de Segurança no Fallback**

**Arquivo**: `ActionsWebhookService.ts` (linhas 1575-1579)

**Antes**:
```typescript
if (execFn === undefined) {
  console.log(`[MENU NODE] Opção inválida: "${pressKey}". Enviando mensagem de fallback.`);

  let optionsText = "";
  nodeSelected.data.arrayOption.forEach(item => {  // ❌ Pode falhar!
    optionsText += `[${item.number}] ${item.value}\n`;
  });
}
```

**Depois**:
```typescript
if (execFn === undefined) {
  console.log(`[MENU NODE] Opção inválida: "${pressKey}". Enviando mensagem de fallback.`);

  // ✅ CORREÇÃO: Verificar se nodeSelected.data e arrayOption existem
  if (!nodeSelected || !nodeSelected.data || !nodeSelected.data.arrayOption) {
    logger.error(`[MENU NODE] Erro: nodeSelected.data.arrayOption não existe para ticket ${ticket?.id}`);
    break;
  }

  let optionsText = "";
  nodeSelected.data.arrayOption.forEach(item => {
    optionsText += `[${item.number}] ${item.value}\n`;
  });
}
```

**Benefícios**:
- ✅ Verifica existência de `nodeSelected`, `data` e `arrayOption`
- ✅ Registra erro detalhado se dados não existirem
- ✅ Sai do loop graciosamente em vez de crashar

---

### **Correção 3: Verificação de Segurança na Criação de Menu**

**Arquivo**: `ActionsWebhookService.ts` (linhas 1645-1649)

**Antes**:
```typescript
} else {
  // console.log(`[MENU NODE] Criando menu sem pressKey`);

  let optionsMenu = "";
  nodeSelected.data.arrayOption.map(item => {  // ❌ Pode falhar!
    optionsMenu += `[${item.number}] ${item.value}\n`;
  });
}
```

**Depois**:
```typescript
} else {
  // console.log(`[MENU NODE] Criando menu sem pressKey`);

  // ✅ CORREÇÃO: Verificar se nodeSelected.data e arrayOption existem
  if (!nodeSelected || !nodeSelected.data || !nodeSelected.data.arrayOption) {
    logger.error(`[MENU NODE] Erro: nodeSelected.data.arrayOption não existe ao criar menu para ticket ${ticket?.id}`);
    break;
  }

  let optionsMenu = "";
  nodeSelected.data.arrayOption.map(item => {
    optionsMenu += `[${item.number}] ${item.value}\n`;
  });
}
```

**Benefícios**:
- ✅ Mesma proteção para criação de menu inicial
- ✅ Consistência em todas as partes que acessam `arrayOption`

---

## 🎯 Fluxo Corrigido

### **Antes (Problemático)**:
```
1. Usuário envia "3" (inválida)
2. Sistema detecta opção inválida
3. Cria nodeSelected = { type: "menu" }  ❌ SEM DATA
4. Envia fallback
5. Break - mantém fluxo ativo
6. Usuário envia nova mensagem
7. flowBuilderQueue tenta retomar
8. ActionsWebhookService executa
9. Tenta acessar nodeSelected.data.arrayOption  ❌ ERRO!
10. Fluxo morre, ticket resetado
```

### **Depois (Correto)**:
```
1. Usuário envia "3" (inválida)
2. Sistema detecta opção inválida
3. Busca nodeSelected completo: nodes.filter(node => node.id === next)[0]  ✅ COM DATA
4. Verifica se nodeSelected.data.arrayOption existe  ✅ EXISTE
5. Envia fallback com opções corretas
6. Break - mantém fluxo ativo
7. Usuário envia nova mensagem (ex: "2")
8. flowBuilderQueue retoma fluxo
9. ActionsWebhookService executa normalmente
10. Fluxo continua  ✅ SUCESSO!
```

---

## 📊 Cenários de Teste

### **Teste 1: Resposta Inválida Seguida de Válida**
```
Bot: "Você é nosso cliente? [1] Sim [2] Não"
User: "3"
Bot: "Opção inválida. Por favor, escolha uma das opções..."
User: "2"
Bot: "Perfeito! Para darmos andamento..."  ✅ CONTINUA
```

### **Teste 2: Múltiplas Respostas Inválidas**
```
Bot: "Você é nosso cliente? [1] Sim [2] Não"
User: "abc"
Bot: "Opção inválida. Por favor, escolha uma das opções..."
User: "xyz"
Bot: "Opção inválida. Por favor, escolha uma das opções..."
User: "1"
Bot: "Perfeito! Qual o seu nome?"  ✅ CONTINUA
```

### **Teste 3: Resposta Inválida em Menu Profundo**
```
Bot: "Para quais serviços? [1] Trabalhista [2] Previdência..."
User: "99"
Bot: "Opção inválida. Por favor, escolha uma das opções..."
User: "7"
Bot: "Entendido! Para casos na área do Direito ao Consumidor..."  ✅ CONTINUA
```

---

## 🔧 Logs Adicionados

### **Log de Erro - Nó Não Encontrado**:
```
[MENU NODE] Nó Mdl2Fv47G7lswfi6XUrdv8lSIuP1VD não encontrado após resposta inválida
```

### **Log de Erro - Data Ausente**:
```
[MENU NODE] Erro: nodeSelected.data.arrayOption não existe para ticket 144
```

### **Log de Sucesso - Fallback Enviado**:
```
[MENU NODE] Fallback enviado para ticket 144. Ticket configurado para aguardar nova resposta (flowWebhook=true, lastFlowId=Mdl2Fv47G7lswfi6XUrdv8lSIuP1VD).
```

---

## 📝 Arquivos Modificados

1. **`/backend/src/services/WebhookService/ActionsWebhookService.ts`**
   - Linha 434-441: Correção de criação de nodeSelected
   - Linha 1575-1579: Verificação de segurança no fallback
   - Linha 1630: Return em vez de break (evita duplicação)
   - Linha 1645-1649: Verificação de segurança na criação de menu

---

## ✅ Resultado Final

### **Antes**:
- ❌ Fluxo morria após resposta inválida
- ❌ Ticket ficava travado sem responder
- ❌ Erro: `Cannot read properties of undefined (reading 'arrayOption')`
- ❌ Estado do ticket resetado (`flowWebhook=false`)

### **Depois**:
- ✅ Fluxo continua após resposta inválida
- ✅ Ticket responde normalmente à próxima mensagem
- ✅ Sem erros de `undefined`
- ✅ Estado do ticket mantido corretamente
- ✅ Usuário pode corrigir resposta e prosseguir
- ✅ **Mensagem de fallback enviada apenas 1 vez** (sem duplicação)

---

## 🎯 Impacto

- ✅ **Robustez**: Fluxos não morrem mais com respostas inválidas
- ✅ **UX**: Usuários podem corrigir erros sem travar o atendimento
- ✅ **Logs**: Erros são registrados de forma clara para debug
- ✅ **Consistência**: Mesma proteção em todos os pontos de acesso a `arrayOption`

**Status**: ✅ CORREÇÃO APLICADA - Fluxos agora sobrevivem a respostas inválidas
