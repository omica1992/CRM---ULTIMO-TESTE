# Exemplos de Criação de Templates da API Oficial

## Como usar os endpoints

### 1. Listar Templates
```http
GET /templates?whatsappId=1
Authorization: Bearer {token}
```

### 2. Criar Template
```http
POST /templates/1
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "welcome_message",
  "category": "UTILITY",
  "language": "pt_BR",
  "parameter_format": "positional",
  "components": [
    {
      "type": "BODY",
      "text": "Olá {{1}}! Bem-vindo à nossa empresa. Como posso ajudá-lo hoje?",
      "example": {
        "body_text": ["João"]
      }
    }
  ]
}
```

### 3. Template com Botões
```json
{
  "name": "order_confirmation",
  "category": "UTILITY", 
  "language": "pt_BR",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Confirmação de Pedido"
    },
    {
      "type": "BODY",
      "text": "Seu pedido #{{1}} foi confirmado! Total: R$ {{2}}. Prazo de entrega: {{3}} dias úteis.",
      "example": {
        "body_text": ["12345", "199,90", "3-5"]
      }
    },
    {
      "type": "FOOTER",
      "text": "Obrigado por escolher nossa empresa!"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "Rastrear Pedido"
        },
        {
          "type": "QUICK_REPLY", 
          "text": "Cancelar Pedido"
        }
      ]
    }
  ]
}
```

### 4. Template com Parâmetros Nomeados
```json
{
  "name": "appointment_reminder",
  "category": "UTILITY",
  "language": "pt_BR", 
  "parameter_format": "named",
  "components": [
    {
      "type": "BODY",
      "text": "Olá {{customer_name}}! Lembrete: você tem um agendamento em {{appointment_date}} às {{appointment_time}}.",
      "example": {
        "body_text_named_params": [
          {
            "param_name": "customer_name",
            "example": "Maria Silva"
          },
          {
            "param_name": "appointment_date", 
            "example": "15/01/2025"
          },
          {
            "param_name": "appointment_time",
            "example": "14:30"
          }
        ]
      }
    }
  ]
}
```

### 5. Buscar Template por ID
```http
GET /templates/1/{templateId}
Authorization: Bearer {token}
```

### 6. Atualizar Template
```http
PUT /templates/1/{templateId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "category": "MARKETING",
  "components": [
    {
      "type": "BODY",
      "text": "Nova mensagem atualizada..."
    }
  ]
}
```

### 7. Deletar Template
```http
DELETE /templates/1/{templateName}
Authorization: Bearer {token}
```

## Categorias de Template

- **AUTHENTICATION**: Templates para autenticação (OTP, códigos de verificação)
- **MARKETING**: Templates promocionais e de marketing
- **UTILITY**: Templates utilitários (confirmações, lembretes, informativos)

## Tipos de Componentes

- **HEADER**: Cabeçalho (texto, imagem, vídeo ou documento)
- **BODY**: Corpo principal da mensagem (obrigatório)
- **FOOTER**: Rodapé da mensagem
- **BUTTONS**: Botões interativos

## Tipos de Botões

- **QUICK_REPLY**: Resposta rápida
- **URL**: Link para website
- **PHONE_NUMBER**: Número de telefone

## Formatos de Parâmetros

- **positional**: Parâmetros numerados ({{1}}, {{2}}, {{3}})  
- **named**: Parâmetros nomeados ({{customer_name}}, {{order_id}})

## Status de Template

- **PENDING**: Aguardando aprovação do WhatsApp
- **APPROVED**: Aprovado e disponível para uso
- **REJECTED**: Rejeitado pelo WhatsApp
- **DISABLED**: Desabilitado

## Integração com Sistema

Quando um template é criado via API:
1. É enviado para a API da Meta/WhatsApp
2. É salvo no banco local como QuickMessage com `isOficial: true`
3. Fica disponível para uso em campanhas, agendamentos e respostas rápidas

## Variáveis de Ambiente Necessárias

```env
API_OFICIAL_URL=http://localhost:3001
API_OFICIAL_TOKEN=your_api_token_here
```
