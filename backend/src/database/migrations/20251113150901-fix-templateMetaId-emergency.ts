import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      console.log('Iniciando correção de emergência para templateMetaId...');

      // 1. Verificar se existe registros com problemas
      const [problemRecords] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as count
        FROM "Schedules" 
        WHERE "templateMetaId" = '' OR "templateMetaId" = '0';
      `);

      const count = (problemRecords[0] as any).count;
      console.log(`Encontrados ${count} registros com templateMetaId problemático`);

      if (count > 0) {
        // 2. Corrigir registros problemáticos
        await queryInterface.sequelize.query(`
          UPDATE "Schedules" 
          SET "templateMetaId" = NULL 
          WHERE "templateMetaId" = '' 
          OR "templateMetaId" = '0'
          OR "templateMetaId" IS NULL;
        `);
        console.log(`${count} registros corrigidos para NULL`);
      }

      // 3. Verificar tipo da coluna
      const [columnInfo] = await queryInterface.sequelize.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Schedules' AND column_name = 'templateMetaId';
      `);

      const currentType = (columnInfo[0] as any).data_type;
      console.log(`Tipo atual da coluna templateMetaId: ${currentType}`);

      // 4. Se ainda não é integer, converter
      if (currentType !== 'integer') {
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
        console.log('Coluna convertida para INTEGER');
      }

      console.log('Correção de emergência concluída com sucesso!');

    } catch (error) {
      console.error('Erro na correção de emergência:', error);
      // Não lançar erro para não quebrar outras migrações
      console.log('Continuando com outras migrações...');
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Não fazer nada no rollback para evitar problemas
    console.log('Rollback da correção de emergência - nenhuma ação necessária');
  }
};
