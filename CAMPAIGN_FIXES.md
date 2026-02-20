# Correções de Campanha - Validação de Horário e Debug de Templates

## 📋 Resumo das Alterações

### 1. ✅ Correção do Retorno de Templates no Backend

**Problema**: Backend carregava templates corretamente mas frontend recebia estrutura errada.

**Causa Raiz**: O serviço `ListTemplatesService` estava retornando apenas o array de templates, mas o tipo `IResultTemplates` espera:
```typescript
{
  data: Array<...>,
  paging: {...}
}
```

**Solução**: Corrigido para retornar a estrutura completa.

**Arquivo Modificado**: `/backend/src/services/TemplateService/ListTemplatesService.ts` (linhas 60-82)

```typescript
// ✅ ANTES (ERRADO):
const templates = response.data?.data || response.data;
return templates; // ❌ Retorna apenas array

// ✅ DEPOIS (CORRETO):
const result = response.data as IResultTemplates;
return result; // ✅ Retorna { data: [...], paging: {...} }
```

**Logs Melhorados**:
```
[TEMPLATES] ✅ Encontrados 2 templates
[TEMPLATES] Estrutura da resposta: { hasData: true, hasPaging: true, templatesCount: 2 }
```

---

### 2. ✅ Validação de 5 Minutos Mínimos para Disparo

**Problema**: Campanhas podiam ser agendadas para horários muito próximos, causando falha no processamento dos jobs pela fila Bull.

**Solução**: Implementada validação em **duas camadas**:

#### 2.1. Validação no Schema Yup (Backend de Validação)

**Arquivo**: `/frontend/src/components/CampaignModal/index.js` (linhas 107-114)

```javascript
scheduledAt: Yup.date()
  .test('min-5-minutes', 'O horário deve ser pelo menos 5 minutos no futuro', function(value) {
    if (!value) return true; // Permite vazio
    const now = moment();
    const scheduled = moment(value);
    const diffMinutes = scheduled.diff(now, 'minutes');
    return diffMinutes >= 5;
  }),
```

#### 2.2. Bloqueio no Campo HTML (Prevenção Visual)

**Arquivo**: `/frontend/src/components/CampaignModal/index.js` (linhas 846-848)

```javascript
<Field
  as={TextField}
  type="datetime-local"
  inputProps={{
    min: moment().add(5, 'minutes').format('YYYY-MM-DDTHH:mm')
  }}
  // ... outros props
/>
```

**Comportamento**:
- ✅ **Campo HTML**: Bloqueia seleção de horários < 5 minutos (usuário não consegue selecionar)
- ✅ **Validação Yup**: Valida ao submeter o formulário (camada de segurança)
- ✅ Permite horários vazios (para campanhas imediatas)
- ✅ Mostra mensagem de erro clara ao usuário
- ✅ Previne criação de jobs que não serão processados

**Exemplo de Erro**:
```
❌ O horário deve ser pelo menos 5 minutos no futuro
```

---

### 3. Logs Detalhados para Debug de Templates no Frontend

**Problema**: Difícil diagnosticar por que templates não apareciam no modal.

**Solução**: Adicionados logs detalhados para rastrear o carregamento de templates e exibir erros ao usuário.

**Arquivo Modificado**: `/frontend/src/components/CampaignModal/index.js` (linhas 459-472)

```javascript
// CORREÇÃO: Buscar templates da Meta API, não quick-messages
// ✅ CORREÇÃO: Buscar templates da Meta API, não quick-messages
if (selectedWhatsapp?.channel === "whatsapp_oficial") {
  console.log(`[CAMPAIGN MODAL] Buscando templates para whatsappId=${whatsappId}`);
  api.get(`/templates?whatsappId=${whatsappId}`)
    .then(({ data }) => {
      console.log("[CAMPAIGN MODAL] 📋 Templates Meta carregados:", {
        total: data.data?.length || 0,
        templates: data.data?.map(t => ({ id: t.id, name: t.name, status: t.status }))
      });
      setAvailableTemplates(data.data || []);
    })
    .catch(err => {
      console.error("[CAMPAIGN MODAL] ❌ Erro ao buscar templates:", err.response?.data || err.message);
      toastError(err);  // ✅ NOVO: Mostra erro ao usuário
      setAvailableTemplates([]);
    });
}
```

**Logs Implementados**:

1. **Início da Busca**:
   ```
   [CAMPAIGN MODAL] Buscando templates para whatsappId=6
   ```

2. **Sucesso**:
   ```
   [CAMPAIGN MODAL] 📋 Templates Meta carregados: {
     total: 25,
     templates: [
       { id: "891516909967373", name: "agendamento_onboarding", status: "APPROVED" },
       { id: "3727498230719643", name: "promocao_ceva", status: "APPROVED" },
       ...
     ]
   }
   ```

3. **Erro**:
   ```
   [CAMPAIGN MODAL] ❌ Erro ao buscar templates: Request failed with status code 400
   ```
   + Toast de erro exibido ao usuário

---

## 🧪 Como Testar

### Teste 1: Validação de 5 Minutos

1. Abra o modal de criar campanha
2. Selecione uma conexão WhatsApp
3. Tente agendar para **agora** ou **2 minutos no futuro**
4. **Resultado Esperado**: Erro "O horário deve ser pelo menos 5 minutos no futuro"
5. Agende para **6 minutos no futuro**
6. **Resultado Esperado**: Validação passa

### Teste 2: Debug de Templates

1. Abra o Console do navegador (F12)
2. Abra o modal de criar campanha
3. Selecione uma conexão **API Oficial**
4. **Verifique os logs**:
   ```
   [CAMPAIGN MODAL] Buscando templates para whatsappId=X
   [CAMPAIGN MODAL] 📋 Templates Meta carregados: { total: Y, templates: [...] }
   ```
5. Se houver erro, verifique:
   - Toast de erro aparece na tela
   - Log de erro no console com detalhes

---

## 🔧 Diagnóstico de Problemas

### Se templates não aparecem:

1. **Verifique o console do navegador**:
   ```javascript
   // Deve aparecer:
   [CAMPAIGN MODAL] Buscando templates para whatsappId=6
   [CAMPAIGN MODAL] 📋 Templates Meta carregados: { total: 25, ... }
   ```

2. **Se aparecer erro 400/404**:
   - Verifique se o endpoint `/templates?whatsappId=X` está funcionando no backend
   - Teste diretamente: `curl http://localhost:8080/templates?whatsappId=6`

3. **Se `total: 0`**:
   - Não há templates aprovados para essa conexão
   - Verifique no Facebook Business Manager se templates foram aprovados

4. **Se não aparecer nenhum log**:
   - O `whatsappId` não está sendo setado
   - Verifique se a conexão selecionada é API Oficial

---

## 📊 Problema Original da Campanha 101

### Diagnóstico Completo:

**Campanha**:
- ID: 101
- Nome: "E-consignado NOVEMBRO"
- Status: FINALIZADA
- scheduledAt: 14:03
- completedAt: 14:09

**Registros de Envio**:
- 19 registros criados às 14:01
- `deliveredAt`: NULL (todos)
- `jobId`: Preenchido (349052-349070)

**Problema Identificado**:
❌ **Jobs NÃO foram processados pela fila Bull**

**Causa Raiz**:
1. Worker da fila de campanhas não estava rodando
2. Jobs criados mas nunca executados
3. Campanha marcada como FINALIZADA sem enviar mensagens

**Evidências**:
- ✅ Logs mostram erros 400 em outros envios (templates/mensagens normais)
- ❌ ZERO logs de `[CAMPAIGN-DISPATCH]` no horário 17:01 UTC
- ❌ ZERO logs de `handleDispatchCampaign`
- ❌ Nenhum processamento de jobs 349052-349070

**Solução Aplicada**:
```bash
pm2 restart backend
```

---

## 📝 Próximos Passos

1. **Reiniciar backend** para garantir que workers estão ativos
2. **Criar campanha de teste** com horário >= 5 minutos no futuro
3. **Monitorar logs** em tempo real:
   ```bash
   pm2 logs backend --lines 100
   ```
4. **Verificar se aparecem logs**:
   - `[CAMPAIGN-DISPATCH] 📤 Disparo solicitado`
   - `[CAMPAIGN-DISPATCH] 📋 Enviando template`
   - `[CAMPAIGN-DISPATCH] ✅ Template enviado`

---

## ⚠️ Importante

A validação de 5 minutos **NÃO resolve** o problema da fila Bull travada, mas **previne** que campanhas sejam criadas com horários impossíveis de processar.

O problema real era que **o worker não estava processando jobs**, independente do horário agendado.

**Status**: ✅ CORREÇÕES APLICADAS - Validação de 5 minutos + Logs de debug de templates
