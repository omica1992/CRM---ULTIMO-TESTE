const { execSync } = require('child_process');

console.log('🔄 Tentando adicionar coluna showTemplates...');

try {
  // Tentar via psql se estiver disponível
  const addColumnSQL = `
    DO $$ 
    BEGIN 
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Users' AND column_name = 'showTemplates'
        ) THEN
            ALTER TABLE "Users" ADD COLUMN "showTemplates" VARCHAR(255) DEFAULT 'disabled';
            RAISE NOTICE 'Coluna showTemplates adicionada com sucesso!';
        ELSE
            RAISE NOTICE 'Coluna showTemplates já existe!';
        END IF;
    END $$;
  `;
  
  console.log('Execute este SQL no seu PostgreSQL:');
  console.log('=====================================');
  console.log(addColumnSQL);
  console.log('=====================================');
  
} catch (error) {
  console.error('❌ Erro:', error.message);
}
