# Correção: Templates com Mídia - Requisito HTTPS da Meta API

## Problema Identificado

Ao criar templates com mídia (imagens, vídeos, documentos), a Meta API retornava erro:
```
Error 131009 (subcode 2494102): "O nome de usuário de mídia é inválido"
```

## Causa Raiz

A Meta API tem requisitos específicos para templates com mídia:

1. **URLs devem usar HTTPS** (não HTTP)
2. **URLs devem ser publicamente acessíveis**
3. **Meta valida a URL no momento da criação do template**
4. **IDs de mídia do upload NÃO funcionam para templates** (apenas para mensagens diretas)

### Por que o upload de mídia não funciona?

O método `uploadMedia()` da Meta API retorna um ID de mídia que é válido **APENAS para mensagens diretas**, não para templates. Para templates, a Meta exige uma URL pública acessível.

## Correções Implementadas

### 1. API Oficial - Validação de URL (templates-whatsapp.service.ts)

```typescript
// ✅ Removido upload de mídia (não funciona para templates)
// ✅ Validação de URL HTTPS
if (!mediaUrl.startsWith('https://')) {
  throw new Error('URL da mídia deve usar HTTPS (não HTTP)');
}

// ✅ Verificação de acessibilidade
const response = await axios.head(mediaUrl, { timeout: 5000 });
if (response.status !== 200) {
  throw new Error(`URL da mídia retornou status ${response.status}`);
}
```

### 2. Backend - Geração de URL HTTPS (UploadTemplateMediaService.ts)

```typescript
// ✅ Força HTTPS em produção
let baseUrl = process.env.BACKEND_URL || 'http://localhost:8080';

if (!baseUrl.startsWith('http://localhost')) {
  baseUrl = baseUrl.replace('http://', 'https://');
}

// ✅ Warnings para localhost
if (baseUrl.includes('localhost')) {
  console.warn('⚠️ URL localhost não funcionará com Meta API!');
  console.warn('⚠️ Configure BACKEND_URL com domínio HTTPS');
}
```

## Configuração Necessária

### Opção 1: Usar Domínio com HTTPS (Recomendado)

Configure no `.env` do backend:

```env
BACKEND_URL=https://seu-dominio.com
PORT=8080
```

**Requisitos:**
- Domínio próprio (ex: `crm.suaempresa.com`)
- Certificado SSL válido (Let's Encrypt gratuito)
- Nginx ou Apache como proxy reverso

**Exemplo de configuração Nginx:**

```nginx
server {
    listen 443 ssl http2;
    server_name crm.suaempresa.com;

    ssl_certificate /etc/letsencrypt/live/crm.suaempresa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.suaempresa.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /public/ {
        alias /caminho/para/backend/public/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Opção 2: Usar Túnel Temporário (Desenvolvimento)

Para testes, use ngrok ou similar:

```bash
# Instalar ngrok
npm install -g ngrok

# Criar túnel HTTPS
ngrok http 8080

# Copiar URL HTTPS gerada (ex: https://abc123.ngrok.io)
# Configurar no .env:
BACKEND_URL=https://abc123.ngrok.io
```

**⚠️ Atenção:** Túneis são temporários e não devem ser usados em produção!

### Opção 3: Cloudflare Tunnel (Gratuito)

```bash
# Instalar cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/

# Criar túnel
cloudflared tunnel create crm-backend

# Configurar rota
cloudflared tunnel route dns crm-backend crm.seudominio.com

# Executar túnel
cloudflared tunnel run crm-backend
```

## Verificação

### 1. Testar URL Pública

```bash
# Verificar se URL está acessível via HTTPS
curl -I https://seu-dominio.com/public/template-media/1/teste.png

# Deve retornar:
# HTTP/2 200
# content-type: image/png
```

### 2. Testar Upload

1. Acesse a página de Templates
2. Clique em "Novo Template"
3. Adicione um HEADER com formato IMAGE
4. Faça upload de uma imagem
5. Verifique se a URL gerada usa HTTPS
6. Tente criar o template

### 3. Logs Importantes

**Backend (UploadTemplateMediaService):**
```
[UPLOAD TEMPLATE MEDIA] Arquivo salvo: template_1234567890_abc123.png
[UPLOAD TEMPLATE MEDIA] URL pública: https://seu-dominio.com/public/...
```

**API Oficial (templates-whatsapp.service):**
```
[CREATE TEMPLATE] Validando mídia: https://seu-dominio.com/public/...
[CREATE TEMPLATE] ✅ Mídia validada e acessível
[META] Criando template: teste_midia
[META] ✅ Template criado com sucesso
```

## Estrutura de Template Correto

```json
{
  "name": "teste_midia",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": {
        "header_handle": [
          "https://seu-dominio.com/public/template-media/1/template_123.png"
        ]
      }
    },
    {
      "type": "BODY",
      "text": "Seu texto aqui"
    }
  ]
}
```

## Erros Comuns

### Erro: "O nome de usuário de mídia é inválido"

**Causa:** URL usa HTTP em vez de HTTPS ou não está acessível

**Solução:** 
1. Verificar se `BACKEND_URL` usa HTTPS
2. Testar acessibilidade da URL com `curl`
3. Verificar firewall/proxy reverso

### Erro: "URL da mídia não está acessível"

**Causa:** Meta não consegue acessar a URL

**Solução:**
1. Verificar se servidor está acessível externamente
2. Verificar regras de firewall
3. Verificar se pasta `public/` tem permissões corretas
4. Testar URL em navegador anônimo

### Warning: "URL localhost detectada"

**Causa:** `BACKEND_URL` não está configurado ou usa localhost

**Solução:** Configure `BACKEND_URL` no `.env` com domínio HTTPS real

## Arquivos Modificados

1. `/api_oficial/src/resources/v1/templates-whatsapp/templates-whatsapp.service.ts`
   - Removido upload de mídia (não funciona para templates)
   - Adicionada validação de URL HTTPS
   - Adicionada verificação de acessibilidade

2. `/backend/src/services/TemplateService/UploadTemplateMediaService.ts`
   - Força HTTPS em URLs de produção
   - Warnings para localhost
   - Logs detalhados

## Referências

- [Meta WhatsApp Business API - Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [Meta API - Media Upload](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)
- [Let's Encrypt - Certificados SSL Gratuitos](https://letsencrypt.org/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

## Status

✅ **CORRIGIDO** - Sistema agora valida URLs HTTPS e alerta sobre configurações incorretas
