# Guia de Upload de Mídia para Templates da Meta

## 📚 Contexto

A Meta API exige que templates com mídia usem um **handle** (identificador único) gerado pela **Resumable Upload API**, não URLs diretas.

### Diferença Importante:

| Operação | Campo | Tipo de Valor |
|----------|-------|---------------|
| **Criar Template** | `header_handle` | Handle da Meta (ex: `4:aW1h...`) |
| **Enviar Mensagem** | `link` | URL direta (ex: `https://...`) |

## 🚀 Implementação

### 1. Upload Simples (Apenas Local)

```javascript
// Frontend
const formData = new FormData();
formData.append('file', file);

const { data } = await api.post('/templates/upload-media', formData);
// Retorna: { publicUrl, filename, path }
```

**Resultado**: Arquivo salvo localmente, URL gerada.  
**Uso**: Templates sem garantia de aprovação pela Meta.

---

### 2. Upload com Meta API (RECOMENDADO)

```javascript
// Frontend
const formData = new FormData();
formData.append('file', file);
formData.append('uploadToMeta', 'true');
formData.append('accessToken', whatsapp.tokenAPI);
formData.append('whatsappBusinessAccountId', whatsapp.wabaId);

const { data } = await api.post('/templates/upload-media', formData);
// Retorna: { publicUrl, filename, path, metaHandle }
```

**Resultado**: Arquivo salvo localmente + handle da Meta gerado.  
**Uso**: Templates com garantia de aprovação.

---

## 🔍 Logs Detalhados

### Upload para Meta API

```
[UPLOAD TO META] 📤 Iniciando upload para Meta API
[UPLOAD TO META] Arquivo: imagem.jpg
[UPLOAD TO META] Tipo: image/jpeg
[UPLOAD TO META] Tamanho: 45678 bytes
[UPLOAD TO META] WABA ID: 123456789

[UPLOAD TO META] 🔄 Passo 1: Criando sessão de upload...
[UPLOAD TO META] 📋 Payload da sessão:
{
  "file_length": 45678,
  "file_type": "image/jpeg",
  "access_token": "EAAxxxxx..."
}

[UPLOAD TO META] ✅ Sessão criada com sucesso
[UPLOAD TO META] 📋 Resposta da sessão:
{
  "id": "upload_session_123",
  "h": "4:aW1hZ2VuX2hhc2g="
}

[UPLOAD TO META] 🔄 Passo 2: Fazendo upload do arquivo...
[UPLOAD TO META] Upload Session ID: upload_session_123

[UPLOAD TO META] ✅ Upload concluído com sucesso
[UPLOAD TO META] 🎉 Handle gerado: 4:aW1hZ2VuX2hhc2g=
```

### Criação de Template

```
================================================================================
[CREATE TEMPLATE] 📤 PAYLOAD COMPLETO ENVIADO PARA META API
================================================================================
[CREATE TEMPLATE] 🌐 URL: https://api-oficial.com/v1/templates-whatsapp/token123
[CREATE TEMPLATE] 📋 Payload JSON:
{
  "name": "meu_template",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": {
        "header_handle": ["4:aW1hZ2VuX2hhc2g="]
      }
    },
    {
      "type": "BODY",
      "text": "Olá {{1}}, tudo bem?"
    }
  ]
}
================================================================================

[CREATE TEMPLATE] ✅ HEADER com Meta Handle (CORRETO): 4:aW1hZ2VuX2hhc2g=

================================================================================
[CREATE TEMPLATE] 📥 RESPOSTA DA META API
================================================================================
[CREATE TEMPLATE] Status: 200
[CREATE TEMPLATE] Resposta JSON:
{
  "id": "123456789",
  "status": "PENDING",
  "category": "MARKETING"
}
================================================================================
```

### Detecção de URL vs Handle

```
[CREATE TEMPLATE] ⚠️ HEADER com URL (pode não funcionar): https://domain.com/image.jpg
[CREATE TEMPLATE] ⚠️ Recomendação: Use upload para Meta API para obter handle correto
```

---

## 🎯 Fluxo Completo Recomendado

### 1. Frontend: Upload de Mídia

```javascript
const uploadMedia = async (file, whatsapp) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploadToMeta', 'true');
  formData.append('accessToken', whatsapp.tokenAPI);
  formData.append('whatsappBusinessAccountId', whatsapp.wabaId);

  const { data } = await api.post('/templates/upload-media', formData);
  
  if (data.metaHandle) {
    console.log('✅ Handle da Meta:', data.metaHandle);
    return data.metaHandle; // Usar este no template
  } else {
    console.warn('⚠️ Apenas URL local:', data.publicUrl);
    return data.publicUrl; // Fallback (pode não funcionar)
  }
};
```

### 2. Frontend: Criar Template

```javascript
const createTemplate = async (templateData, mediaHandle) => {
  const payload = {
    name: 'meu_template',
    category: 'MARKETING',
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        example: {
          header_handle: [mediaHandle] // Handle da Meta
        }
      },
      {
        type: 'BODY',
        text: 'Olá {{1}}, tudo bem?',
        example: {
          body_text: [['João']]
        }
      }
    ]
  };

  const { data } = await api.post(`/templates/${whatsappId}`, payload);
  return data;
};
```

---

## 🔧 Configuração Necessária

### Backend (.env)

```env
# URL da API Oficial (NestJS)
URL_API_OFICIAL=http://localhost:3001

# Token de autenticação
TOKEN_API_OFICIAL=seu_token_aqui

# URL pública do backend (para URLs locais)
BACKEND_URL=https://seu-dominio.com
```

### Modelo Whatsapp

Certifique-se de que o modelo `Whatsapp` tenha os campos:

```typescript
{
  token: string;        // Token da conexão
  tokenMeta: string;    // Access Token da Meta (CORRETO)
  waba_id: string;      // WhatsApp Business Account ID (CORRETO)
  provider: string;     // "oficial" ou "beta"
  channel: string;      // "whatsapp_oficial"
}
```

**⚠️ IMPORTANTE**: Os nomes dos campos são:
- `tokenMeta` (não `tokenAPI`)
- `waba_id` (não `wabaId`)

---

## 📊 Comparação: URL vs Handle

| Aspecto | URL Local | Handle da Meta |
|---------|-----------|----------------|
| **Aprovação** | ⚠️ Pode falhar | ✅ Garantida |
| **Documentação** | ❌ Não oficial | ✅ Oficial |
| **Complexidade** | ✅ Simples | ⚠️ Requer upload |
| **Produção** | ❌ Não recomendado | ✅ Recomendado |
| **Desenvolvimento** | ✅ OK para testes | ✅ Melhor |

---

## 🐛 Troubleshooting

### Erro: "Meta API não retornou handle"

**Causa**: Sessão de upload falhou ou resposta incompleta.

**Solução**:
1. Verificar `accessToken` válido
2. Verificar `whatsappBusinessAccountId` correto
3. Verificar logs: `[UPLOAD TO META]`

### Erro: "Componente HEADER precisa ter mídia"

**Causa**: `header_handle` vazio ou inválido.

**Solução**:
1. Verificar se upload retornou `metaHandle`
2. Verificar formato: deve ser `"4:xxxxx"` (regex: `^\d+:[a-zA-Z0-9+/=]+$`)

### Warning: "HEADER com URL (pode não funcionar)"

**Causa**: Usando URL em vez de handle.

**Solução**:
1. Fazer upload com `uploadToMeta: true`
2. Usar `metaHandle` retornado

---

## 📖 Referências

- [Meta Resumable Upload API](https://developers.facebook.com/docs/graph-api/guides/upload)
- [WhatsApp Cloud API - Message Templates](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates)
- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp)

---

## ✅ Checklist de Implementação

- [x] Criar `UploadToMetaService.ts`
- [x] Atualizar `UploadTemplateMediaService.ts`
- [x] Atualizar `TemplateController.ts`
- [x] Adicionar logs detalhados em `CreateTemplateService.ts`
- [x] Detectar handle vs URL
- [ ] Atualizar frontend para usar `uploadToMeta`
- [ ] Testar upload completo
- [ ] Validar aprovação de template com mídia

---

**Data de Implementação**: 12/12/2024  
**Versão**: 1.0.0
