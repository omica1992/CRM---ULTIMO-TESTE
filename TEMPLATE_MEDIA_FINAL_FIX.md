# Correção Final: Templates com Mídia - Problemas Identificados e Resolvidos

## Problema 1: "O nome de usuário de mídia é inválido"

### Causa
A api_oficial estava fazendo upload da URL para a Meta e substituindo por ID de mídia, mas **IDs de mídia só funcionam para mensagens diretas, não para templates**.

### Solução
Removido o upload de mídia no `templates-whatsapp.service.ts`. Agora a URL HTTPS é enviada diretamente para a Meta.

**Arquivo**: `/api_oficial/src/resources/v1/templates-whatsapp/templates-whatsapp.service.ts`

```typescript
// ❌ ANTES (ERRADO)
const mediaId = await this.metaService.uploadMedia(...);
templateData.components[i].example.header_handle = [mediaId]; // Substituía URL por ID

// ✅ DEPOIS (CORRETO)
// Apenas valida se URL é HTTPS e está acessível
if (!mediaUrl.startsWith('https://')) {
  throw new Error('URL deve usar HTTPS');
}
const response = await axios.head(mediaUrl, { timeout: 5000 });
// Mantém URL original
```

---

## Problema 2: "IMAGE precisa de exemplo mas não foi fornecido"

### Causa
O `CreateTemplateService.ts` estava **removendo** o `example.header_handle` durante a limpeza dos dados porque a validação não estava capturando todos os casos.

### Solução
Melhorada a lógica de preservação do `example.header_handle` com validações mais robustas.

**Arquivo**: `/backend/src/services/TemplateService/CreateTemplateService.ts` (linhas 115-143)

```typescript
// ✅ CORREÇÃO
if (comp.type === 'HEADER' && comp.example.header_handle) {
  // Garantir que header_handle é array
  if (Array.isArray(comp.example.header_handle) && comp.example.header_handle.length > 0) {
    cleanedComp.example = comp.example;
  } else if (typeof comp.example.header_handle === 'string') {
    // Se vier como string, converter para array
    cleanedComp.example = {
      header_handle: [comp.example.header_handle]
    };
  }
}
```

---

## Problema 3: "BODY não contém o(s) campo(s) esperado(s) (example.body_text)"

### Causa
O frontend estava **sempre criando** `example: { body_text: [] }` vazio para componentes BODY, e a Meta API rejeita arrays vazios.

### Solução

#### Backend - Filtrar example vazio
**Arquivo**: `/backend/src/services/TemplateService/CreateTemplateService.ts` (linhas 117-126)

```typescript
// ✅ CORREÇÃO: Só adicionar example.body_text se tiver conteúdo
if (comp.type === 'BODY' && comp.example.body_text) {
  if (Array.isArray(comp.example.body_text) && comp.example.body_text.length > 0) {
    cleanedComp.example = comp.example;
  } else {
    // Não adicionar example vazio
    console.log(`[CREATE TEMPLATE] BODY sem variáveis - removendo example vazio`);
  }
}
```

#### Frontend - Não criar example vazio
**Arquivo**: `/frontend/src/components/TemplateModal/index.js`

```javascript
// ❌ ANTES (ERRADO)
{
  type: "BODY",
  text: "",
  example: { body_text: [] }  // Array vazio!
}

// ✅ DEPOIS (CORRETO)
{
  type: "BODY",
  text: ""
  // Sem example - será adicionado apenas se houver variáveis
}
```

---

## Estrutura Correta do Template

### Template com Mídia no HEADER (sem variáveis no BODY)

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
        "header_handle": ["https://back.mibiadigital.com.br/public/template-media/2/template_xxx.png"]
      }
    },
    {
      "type": "BODY",
      "text": "teste midia template"
      // ✅ SEM example porque não há variáveis
    }
  ]
}
```

### Template com Variáveis no BODY

```json
{
  "name": "teste_variaveis",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    {
      "type": "BODY",
      "text": "Olá {{1}}, seu pedido {{2}} está pronto!",
      "example": {
        "body_text": ["João", "#12345"]  // ✅ COM conteúdo
      }
    }
  ]
}
```

---

## Regras da Meta API para Templates

### HEADER com Mídia
- ✅ **Obrigatório**: `format` (IMAGE, VIDEO, DOCUMENT)
- ✅ **Obrigatório**: `example.header_handle` com URL HTTPS
- ❌ **Não aceita**: IDs de mídia do upload
- ❌ **Não aceita**: URLs HTTP

### BODY
- ✅ **Obrigatório**: `text`
- ✅ **Opcional**: `example.body_text` (apenas se houver variáveis {{1}}, {{2}}, etc)
- ❌ **Não aceita**: `example.body_text` vazio `[]`

### URLs de Mídia
- ✅ **Deve usar HTTPS**
- ✅ **Deve ser publicamente acessível**
- ✅ **Meta valida e baixa a mídia da URL**
- ❌ **Não aceita localhost ou IPs privados**

---

## Arquivos Modificados

### 1. API Oficial
- `/api_oficial/src/resources/v1/templates-whatsapp/templates-whatsapp.service.ts`
  - Removido upload de mídia (linhas 58-92)
  - Adicionada validação de URL HTTPS
  - Adicionada verificação de acessibilidade

### 2. Backend
- `/backend/src/services/TemplateService/CreateTemplateService.ts`
  - Melhorada lógica de preservação de `example.header_handle` (linhas 122-137)
  - Adicionada filtragem de `example.body_text` vazio (linhas 117-126)
  - Logs detalhados para debug

- `/backend/src/services/TemplateService/UploadTemplateMediaService.ts`
  - Força HTTPS em produção (linhas 77-92)
  - Warnings para localhost

### 3. Frontend
- `/frontend/src/components/TemplateModal/index.js`
  - Removido `example: { body_text: [] }` dos valores iniciais (linhas 137-141)
  - Removido do reset (linhas 155-159)
  - Removido do addComponent (linhas 277-281)

---

## Como Testar

### 1. Reiniciar Serviços
```bash
pm2 restart backend
pm2 restart api-oficial
```

### 2. Criar Template com Mídia
1. Acesse a página de Templates
2. Clique em "Novo Template"
3. Preencha:
   - Nome: `teste_midia`
   - Categoria: MARKETING
   - Idioma: pt_BR
4. Adicione HEADER:
   - Formato: IMAGE
   - Faça upload de uma imagem
5. Adicione BODY:
   - Texto: `teste midia template`
   - **NÃO adicione variáveis**
6. Clique em Salvar

### 3. Verificar Logs

**Backend**:
```
[CREATE TEMPLATE] HEADER com formato: IMAGE
[CREATE TEMPLATE] ✅ HEADER com example.header_handle: ["https://back.mibiadigital.com.br/..."]
[CREATE TEMPLATE] BODY sem variáveis - removendo example vazio
[CREATE TEMPLATE] Componente 0 limpo: { type: 'HEADER', format: 'IMAGE', example: {...} }
[CREATE TEMPLATE] Componente 1 limpo: { type: 'BODY', text: '...' }
```

**API Oficial**:
```
[CREATE TEMPLATE] Validando mídia: https://back.mibiadigital.com.br/...
[CREATE TEMPLATE] ✅ Mídia validada e acessível
[META] Criando template: teste_midia
[META] ✅ Template criado com sucesso
```

### 4. Resultado Esperado
✅ Template criado com sucesso
✅ Status: PENDING (aguardando aprovação da Meta)
✅ Sem erros nos logs

---

## Erros Comuns e Soluções

### Erro: "URL localhost detectada"
**Solução**: Configure `BACKEND_URL` no `.env` com domínio HTTPS real

### Erro: "URL não está acessível"
**Solução**: Verifique firewall, proxy reverso e permissões da pasta `public/`

### Erro: "body_text vazio"
**Solução**: Já corrigido - frontend não cria mais example vazio

### Erro: "nome de usuário de mídia inválido"
**Solução**: Já corrigido - não faz mais upload, envia URL diretamente

---

## Status Final

✅ **PROBLEMA 1 RESOLVIDO** - Upload de mídia removido, URL enviada diretamente
✅ **PROBLEMA 2 RESOLVIDO** - example.header_handle preservado corretamente
✅ **PROBLEMA 3 RESOLVIDO** - example.body_text vazio não é mais enviado

**Sistema pronto para criar templates com mídia!** 🎉
