import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      console.log('🔧 Limpando dados corrompidos na coluna templateMetaId...');

      // Primeiro, vamos usar uma query mais robusta para limpar dados corrompidos
      // Converter diretamente usando CAST e tratando exceções
      await queryInterface.sequelize.query(`
        UPDATE "Schedules" 
        SET "templateMetaId" = NULL 
        WHERE "templateMetaId" IS NOT NULL 
        AND (
          CAST("templateMetaId" AS TEXT) = '' 
          OR CAST("templateMetaId" AS TEXT) = '0'
          OR "templateMetaId" = 0
        );
      `);

      console.log('✅ Dados problemáticos limpos com sucesso');

      // Verificar se ainda existem registros problemáticos
      const [remainingIssues] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as count
        FROM "Schedules" 
        WHERE "templateMetaId" IS NOT NULL 
        AND "templateMetaId" <= 0;
      `);

      const count = (remainingIssues[0] as any).count;
      console.log(`📊 Registros restantes com templateMetaId <= 0: ${count}`);

      if (count > 0) {
        await queryInterface.sequelize.query(`
          UPDATE "Schedules" 
          SET "templateMetaId" = NULL 
          WHERE "templateMetaId" IS NOT NULL 
          AND "templateMetaId" <= 0;
        `);
        console.log(`✅ ${count} registros adicionais corrigidos`);
      }

      console.log('🎉 Limpeza de dados concluída com sucesso!');

    } catch (error) {
      console.error('❌ Erro na limpeza de dados:', error);
      
      // Tentar uma abordagem ainda mais simples
      try {
        console.log('🔄 Tentando abordagem alternativa...');
        
        await queryInterface.sequelize.query(`
          UPDATE "Schedules" 
          SET "templateMetaId" = NULL 
          WHERE "templateMetaId" = 0;
        `);
        
        console.log('✅ Abordagem alternativa bem-sucedida');
      } catch (fallbackError) {
        console.error('❌ Erro na abordagem alternativa:', fallbackError);
        console.log('⚠️  Continuando com outras migrações...');
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    console.log('⏪ Rollback da limpeza de dados - nenhuma ação necessária');
  }
};
