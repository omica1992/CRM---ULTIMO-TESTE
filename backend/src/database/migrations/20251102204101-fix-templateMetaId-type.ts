import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      // 1. Verificar se a coluna existe e qual é seu tipo atual
      const [results] = await queryInterface.sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Schedules' AND column_name = 'templateMetaId';
      `);

      if (results.length === 0) {
        console.log('Coluna templateMetaId não encontrada na tabela Schedules. Pulando migração.');
        return;
      }

      const columnInfo = results[0] as any;
      console.log('Informações da coluna templateMetaId:', columnInfo);

      // 2. Remover valor padrão se existir
      if (columnInfo.column_default) {
        await queryInterface.sequelize.query(`
          ALTER TABLE "Schedules" 
          ALTER COLUMN "templateMetaId" 
          DROP DEFAULT;
        `);
      }

      // 3. Atualizar valores problemáticos para NULL
      // Se a coluna já é INTEGER, não podemos usar comparações de string
      if (columnInfo.data_type === 'integer') {
        // Para coluna INTEGER, apenas limpar valores NULL ou 0
        await queryInterface.sequelize.query(`
          UPDATE "Schedules" 
          SET "templateMetaId" = NULL 
          WHERE "templateMetaId" IS NULL 
          OR "templateMetaId" = 0;
        `);
      } else {
        // Para coluna STRING, limpar strings vazias e não numéricas
        await queryInterface.sequelize.query(`
          UPDATE "Schedules" 
          SET "templateMetaId" = NULL 
          WHERE "templateMetaId" = '' 
          OR "templateMetaId" IS NULL 
          OR "templateMetaId" = '0'
          OR NOT ("templateMetaId" ~ '^[1-9][0-9]*$');
        `);
      }

      // 4. Converter templateMetaId de STRING para INTEGER apenas se for diferente de integer
      if (columnInfo.data_type !== 'integer') {
        await queryInterface.sequelize.query(`
          ALTER TABLE "Schedules" 
          ALTER COLUMN "templateMetaId" 
          TYPE INTEGER USING 
            CASE 
              WHEN "templateMetaId" IS NULL THEN NULL
              WHEN "templateMetaId" ~ '^[1-9][0-9]*$' THEN "templateMetaId"::INTEGER
              ELSE NULL
            END;
        `);
      }

      // 5. Verificar se foreign key já existe antes de adicionar
      const [fkResults] = await queryInterface.sequelize.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'Schedules' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'Schedules_templateMetaId_fkey';
      `);

      if (fkResults.length === 0) {
        // Adicionar foreign key apenas se não existir
        await queryInterface.sequelize.query(`
          ALTER TABLE "Schedules"
          ADD CONSTRAINT "Schedules_templateMetaId_fkey"
          FOREIGN KEY ("templateMetaId")
          REFERENCES "QuickMessages" ("id")
          ON UPDATE CASCADE
          ON DELETE SET NULL;
        `);
      }

    } catch (error) {
      console.error('Erro na migração fix-templateMetaId-type:', error);
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Remover foreign key
    await queryInterface.sequelize.query(`
      ALTER TABLE "Schedules"
      DROP CONSTRAINT IF EXISTS "Schedules_templateMetaId_fkey";
    `);

    // Voltar para STRING
    await queryInterface.sequelize.query(`
      ALTER TABLE "Schedules"
      ALTER COLUMN "templateMetaId"
      TYPE VARCHAR(255);
    `);
  }
};
