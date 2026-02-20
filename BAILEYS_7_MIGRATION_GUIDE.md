# Guia de Migração para Baileys 7.x

## Status Atual
- **Baileys Version**: 7.0.0-rc.9
- **Project Type**: CommonJS (precisa migrar para ESM)
- **Node Version**: v20.11.0

## Principais Breaking Changes

### 1. ESM (ES Modules) - CRÍTICO ⚠️
**Problema**: Baileys 7.x é ESM puro, projeto está em CommonJS
**Solução**: Converter projeto para ESM OU usar dynamic imports

#### Opção A: Converter para ESM (Recomendado)
```json
// package.json
{
  "type": "module"
}
```

#### Opção B: Dynamic Imports (Temporário)
```javascript
// Usar await import() em vez de require()
const { default: makeWASocket } = await import('@whiskeysockets/baileys');
```

### 2. LIDs (Local Identifiers) - IMPORTANTE 🔄

#### Mudanças no Sistema de Identificação
- **Antes**: Apenas Phone Numbers (PN) - `5511999999999@s.whatsapp.net`
- **Agora**: LIDs + PNs - `28798376505512@lid` + `5511999999999@s.whatsapp.net`

#### Novos Campos no MessageKey
```typescript
interface MessageKey {
  remoteJid: string;           // Pode ser LID ou PN
  remoteJidAlt?: string;       // Alternativo (se remoteJid é LID, Alt é PN)
  participant?: string;        // Para grupos
  participantAlt?: string;     // Alternativo do participante
  fromMe: boolean;
  id: string;
  addressingMode?: 'lid' | 'pn'; // Novo!
}
```

#### Mudanças no Contact Type
```typescript
// ANTES
interface Contact {
  jid: string;
  name?: string;
}

// AGORA
interface Contact {
  id: string;              // Preferido (pode ser LID ou PN)
  phoneNumber?: string;    // Presente se id é LID
  lid?: string;           // Presente se id é PN
  name?: string;
}
```

#### Funções Removidas/Substituídas
- ❌ `isJidUser()` - REMOVIDA
- ✅ `isPnUser()` - NOVA (verifica se é PN)
- ✅ `isLidUser()` - NOVA (verifica se é LID)

#### LID Mapping Store
```typescript
const store = sock.signalRepository.lidMapping;

// Métodos disponíveis:
store.storeLIDPNMapping(lid, pn);
store.getLIDForPN(pn);
store.getPNForLID(lid);
```

### 3. ACKs - IMPORTANTE ⚠️
**Mudança**: Baileys 7.x NÃO envia mais ACKs automáticos
**Razão**: WhatsApp estava banindo usuários por isso
**Impacto**: Mensagens podem não mostrar status de leitura corretamente

### 4. Protobufs - Redução de Bundle
**Removidos**: Vários métodos dos protos
**Mantidos**: `.create()`, `.encode()`, `.decode()`
**Novo**: `decodeAndHydrate()` - usar sempre ao decodificar

### 5. Meta Coexistence
**Nova Feature**: Suporte para Meta API + WhatsApp Business App simultaneamente
**Status**: Experimental

---

## Correções Já Aplicadas

### ✅ wbotMonitor.ts
- Removida importação de `isJidUser`
- Criada função alternativa: `jid?.endsWith('@s.whatsapp.net')`
- **Arquivo**: `/backend/src/services/WbotServices/wbotMonitor.ts`

---

## Correções Necessárias (Pendentes)

### 1. Migrar para ESM
**Prioridade**: ALTA
**Impacto**: Todo o projeto
**Arquivos**: `package.json`, `tsconfig.json`, todos os `.ts`

### 2. Atualizar Tratamento de LIDs
**Prioridade**: ALTA
**Impacto**: Identificação de usuários
**Arquivos**:
- `/backend/src/services/WbotServices/wbotMessageListener.ts`
- `/backend/src/services/ContactServices/*`
- Todos os lugares que usam `msg.key.remoteJid`

### 3. Substituir `isJidUser()`
**Prioridade**: MÉDIA
**Buscar por**: `isJidUser`
**Substituir por**: Função customizada ou `isPnUser()`

### 4. Atualizar Contact Model
**Prioridade**: MÉDIA
**Adicionar campos**:
- `lid` (string, nullable)
- `phoneNumber` (string, nullable)
- Manter `remoteJid` para compatibilidade

### 5. Implementar LID Mapping
**Prioridade**: MÉDIA
**Criar**: Sistema de cache LID <-> PN
**Usar**: `sock.signalRepository.lidMapping`

---

## Plano de Migração Recomendado

### Fase 1: Estabilização (Urgente)
1. ✅ Corrigir `isJidUser` em wbotMonitor.ts
2. ⏳ Identificar todos os usos de `isJidUser` no projeto
3. ⏳ Criar funções auxiliares para LID/PN

### Fase 2: Compatibilidade (Curto Prazo)
1. ⏳ Atualizar Contact model para suportar LIDs
2. ⏳ Implementar LID mapping store
3. ⏳ Atualizar lógica de identificação de usuários

### Fase 3: Migração ESM (Médio Prazo)
1. ⏳ Converter package.json para type: "module"
2. ⏳ Substituir require() por import
3. ⏳ Atualizar tsconfig.json
4. ⏳ Testar todo o sistema

---

## Referências
- [Guia Oficial de Migração](https://whiskey.so/migrate-latest)
- [Release Notes 7.0.0](https://github.com/WhiskeySockets/Baileys/releases)
- [Documentação LIDs](https://github.com/WhiskeySockets/Baileys/issues/408)

---

## Notas Importantes

### ⚠️ Sobre LIDs
- **NÃO tente converter LID para PN** - LIDs são o futuro
- **Migre sua lógica** para trabalhar com ambos (LID e PN)
- **Use `remoteJidAlt`** quando disponível para obter o formato alternativo

### ⚠️ Sobre ESM
- **Baileys 6.8.0+** é ESM puro
- **CommonJS não é mais suportado** oficialmente
- **Dynamic imports** são solução temporária, não permanente

### ⚠️ Sobre Banimentos
- **Não envie ACKs** manualmente
- **Respeite rate limits** do WhatsApp
- **Use delays** entre mensagens em massa
