-- ============================================
-- FIX: Alterar templateId de INTEGER para VARCHAR
-- ============================================
-- Problema: templateId da Meta API é muito grande para INTEGER
-- Exemplo: 3806438242983138 > 2147483647 (max INTEGER)
-- Solução: Alterar para VARCHAR

-- 1. Verificar tipo atual
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'Campaigns' 
  AND column_name = 'templateId';

-- 2. Alterar tipo da coluna
ALTER TABLE "Campaigns" 
ALTER COLUMN "templateId" TYPE VARCHAR(255) 
USING "templateId"::VARCHAR;

-- 3. Confirmar alteração
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'Campaigns' 
  AND column_name = 'templateId';

-- ============================================
-- RESULTADO ESPERADO:
-- column_name  | data_type      | character_maximum_length
-- templateId   | character varying | 255
-- ============================================
