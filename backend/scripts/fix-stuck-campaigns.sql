-- Script para corrigir campanhas travadas em "EM_ANDAMENTO"
-- Execute este script para finalizar campanhas que já processaram todos os contatos
-- Criado em: 2025-01-13

-- 1. Verificar campanhas potencialmente travadas
SELECT 
  c.id,
  c.name,
  c.status,
  c."scheduledAt",
  c."updatedAt",
  c."isRecurring",
  COUNT(cs.id) as total_shipping,
  SUM(CASE WHEN cs."deliveredAt" IS NOT NULL THEN 1 ELSE 0 END) as delivered,
  SUM(CASE WHEN cs."failedAt" IS NOT NULL THEN 1 ELSE 0 END) as failed,
  COUNT(cli.id) as total_contacts
FROM "Campaigns" c
LEFT JOIN "CampaignShipping" cs ON cs."campaignId" = c.id
LEFT JOIN "ContactLists" cl ON c."contactListId" = cl.id
LEFT JOIN "ContactListItems" cli ON cli."contactListId" = cl.id AND cli."isWhatsappValid" = true
WHERE c.status = 'EM_ANDAMENTO'
GROUP BY c.id, c.name, c.status, c."scheduledAt", c."updatedAt", c."isRecurring"
ORDER BY c."updatedAt" DESC;

-- 2. Finalizar campanhas NÃO RECORRENTES que já processaram todos os contatos
UPDATE "Campaigns"
SET 
  status = 'FINALIZADA', 
  "completedAt" = NOW(),
  "updatedAt" = NOW()
WHERE 
  id IN (
    SELECT c.id 
    FROM "Campaigns" c
    INNER JOIN "ContactLists" cl ON c."contactListId" = cl.id
    LEFT JOIN (
      SELECT 
        "campaignId", 
        COUNT(*) as shipped,
        SUM(CASE WHEN "deliveredAt" IS NOT NULL THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN "failedAt" IS NOT NULL THEN 1 ELSE 0 END) as failed
      FROM "CampaignShipping"
      GROUP BY "campaignId"
    ) cs ON cs."campaignId" = c.id
    LEFT JOIN (
      SELECT 
        "contactListId", 
        COUNT(*) as contacts
      FROM "ContactListItems"
      WHERE "isWhatsappValid" = true
      GROUP BY "contactListId"
    ) cli ON cli."contactListId" = cl.id
    WHERE 
      c.status = 'EM_ANDAMENTO'
      AND c."isRecurring" = false
      AND cs.shipped >= cli.contacts
  );

-- 3. Para campanhas por TAG (sem contactListId), finalizar se não há mais envios pendentes
UPDATE "Campaigns"
SET 
  status = 'FINALIZADA', 
  "completedAt" = NOW(),
  "updatedAt" = NOW()
WHERE 
  id IN (
    SELECT c.id
    FROM "Campaigns" c
    WHERE 
      c.status = 'EM_ANDAMENTO'
      AND c."isRecurring" = false
      AND c."tagListId" IS NOT NULL
      AND c."contactListId" IS NULL
      AND c."updatedAt" < NOW() - INTERVAL '2 hours'
      AND NOT EXISTS (
        SELECT 1 
        FROM "CampaignShipping" cs 
        WHERE 
          cs."campaignId" = c.id 
          AND cs."deliveredAt" IS NULL
          AND cs."failedAt" IS NULL
      )
  );

-- 4. Verificar resultado após correção
SELECT 
  c.id,
  c.name,
  c.status,
  c."completedAt",
  COUNT(cs.id) as total_shipping,
  SUM(CASE WHEN cs."deliveredAt" IS NOT NULL THEN 1 ELSE 0 END) as delivered,
  SUM(CASE WHEN cs."failedAt" IS NOT NULL THEN 1 ELSE 0 END) as failed
FROM "Campaigns" c
LEFT JOIN "CampaignShipping" cs ON cs."campaignId" = c.id
WHERE c."updatedAt" > NOW() - INTERVAL '1 day'
GROUP BY c.id, c.name, c.status, c."completedAt"
ORDER BY c."updatedAt" DESC;

-- 5. (OPCIONAL) Listar erros mais comuns nas campanhas
SELECT 
  "errorMessage",
  COUNT(*) as ocorrencias,
  MAX("failedAt") as ultima_ocorrencia
FROM "CampaignShipping"
WHERE "failedAt" IS NOT NULL
GROUP BY "errorMessage"
ORDER BY ocorrencias DESC
LIMIT 20;
