# Correção de Erros Baileys (Bad MAC, SessionError) - EvolutionAPI#1660

## Problema Identificado

Erros 400 e 403 da Baileys causados por:
- Token inválido de descriptografia
- Sessão expirada  
- Erros: "Bad MAC", "No matching sessions found", "SessionError", "failed to decrypt message"

Esses erros impediam o re-processamento de mensagens pelo retry automático da Baileys, causando perda das primeiras mensagens até a sessão ser válida novamente.

## Solução Implementada (EvolutionAPI#1660)

### 1. Filtro de Mensagens com Erros Conhecidos

**Objetivo**: Pular mensagens com erros de descriptografia para permitir que o retry automático da Baileys funcione.

**Implementação**:
```typescript
const hasKnownDecryptionError = (msg: WAMessage): boolean => {
  if (msg.messageStubParameters && msg.messageStubParameters.length > 0) {
    const knownErrors = [
      'Bad MAC',
      'No matching sessions found',
      'SessionError',
      'failed to decrypt message'
    ];
    
    for (const param of msg.messageStubParameters) {
      for (const error of knownErrors) {
        if (param.includes(error)) {
          logger.warn(
            `[BAILEYS ERROR FILTER] Pulando mensagem com erro de descriptografia: ${error} - Key: ${msg.key.id}`
          );
          return true;
        }
      }
    }
  }
  return false;
};
```

**Aplicação no Event Listener**:
```typescript
wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
  const messages = messageUpsert.messages
    .filter(msg => filterMessages(msg) && !hasKnownDecryptionError(msg))
    .map(msg => msg);
  // ...
});
```

### 2. Fallback para Download de Mídia

**Objetivo**: Usar `downloadContentFromMessage` quando `downloadMediaMessage` falhar.

**Helper de Mapeamento**:
```typescript
const mapMediaType = (msgType: string): MediaType => {
  const mediaTypeMap: { [key: string]: MediaType } = {
    imageMessage: "image",
    videoMessage: "video",
    audioMessage: "audio",
    documentMessage: "document",
    documentWithCaptionMessage: "document",
    stickerMessage: "sticker"
  };
  return mediaTypeMap[msgType] || "document";
};
```

**Implementação do Fallback**:
```typescript
let buffer;
try {
  buffer = await downloadMediaMessage(msg, "buffer", {}, {
    logger,
    reuploadRequest: wbot.updateMediaMessage
  });
} catch (err) {
  logger.warn(`[MEDIA DOWNLOAD] ❌ Falha no downloadMediaMessage, tentando fallback...`);
  
  try {
    await delay(5000); // Aguardar 5 segundos
    
    const msgType = getTypeMessage(msg);
    const mediaType = mapMediaType(msgType);
    const stream = await downloadContentFromMessage(msg.message[msgType], mediaType);
    
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    buffer = Buffer.concat(chunks);
    logger.info(`[MEDIA DOWNLOAD] ✅ Fallback bem-sucedido`);
  } catch (fallbackErr) {
    logger.error(`[MEDIA DOWNLOAD] ❌ Fallback também falhou: ${fallbackErr.message}`);
  }
}
```

## Como Funciona

### Fluxo de Mensagens com Erro
```
1. Baileys recebe mensagem com erro de descriptografia
2. Sistema detecta erro nos messageStubParameters
3. Mensagem é PULADA (não processada)
4. Baileys tenta novamente automaticamente (retry)
5. Nova tentativa com sessão válida → SUCESSO ✅
6. Mensagem é processada normalmente
```

### Fluxo de Download de Mídia
```
1. Tenta downloadMediaMessage
2. Se falhar → aguarda 5 segundos
3. Tenta downloadContentFromMessage (fallback)
4. Monta buffer a partir do stream
5. Retorna mídia baixada
```

## Benefícios

### ✅ Não Bloqueia Retry Automático
- Permite que a Baileys reprocesse mensagens com erro
- Não interfere com mecanismo interno de recuperação

### ✅ Download de Mídia Mais Robusto
- Duas camadas de tentativa de download
- `downloadContentFromMessage` funciona melhor em alguns casos
- Delay de 5s ajuda a evitar rate limiting

### ✅ Logs Detalhados
- Fácil identificação de mensagens com erro
- Rastreamento de sucesso/falha do fallback

### ✅ Melhora na Experiência
- Menos mensagens perdidas
- Recuperação automática de erros temporários
- Download de mídia mais confiável

## Logs Implementados

**Filtro de Erros**:
```
[BAILEYS ERROR FILTER] Pulando mensagem com erro de descriptografia: Bad MAC - Key: xxxxx
```

**Download de Mídia**:
```
[MEDIA DOWNLOAD] ❌ Falha no downloadMediaMessage, tentando fallback...
[MEDIA DOWNLOAD] ✅ Fallback bem-sucedido usando downloadContentFromMessage - Key: xxxxx
[MEDIA DOWNLOAD] ❌ Fallback também falhou: error message - Key: xxxxx
```

## Arquivos Modificados

1. **`wbotMessageListener.ts`**:
   - Adicionada importação: `downloadContentFromMessage`
   - Nova função: `hasKnownDecryptionError()`
   - Nova função: `mapMediaType()`
   - Modificada função: `downloadMedia()` (fallback implementado)
   - Modificado event listener: aplicado filtro de erros

## Referências

- **Pull Request**: EvolutionAPI#1660
- **Autor**: KokeroO  
- **Merge**: DavidsonGomes em 27 Jun
- **Descrição**: Verifica eventos com falhas e fallback para erro ao baixar mídias
- **Mudanças**: +56 −6

## Status

✅ **IMPLEMENTADO** - Sistema agora:
- Filtra mensagens com erros conhecidos de descriptografia
- Permite retry automático da Baileys funcionar
- Implementa fallback robusto para download de mídia
- Logs detalhados para diagnóstico
