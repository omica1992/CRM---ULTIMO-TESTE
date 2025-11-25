import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      console.log("🔄 Iniciando migração para alterar templateMetaId para STRING na tabela Schedules");

      // Passo 1: Verificar se a constraint de chave estrangeira existe
      console.log("🔍 Verificando constraint de chave estrangeira...");
      await queryInterface.sequelize.query(
        `ALTER TABLE "Schedules" DROP CONSTRAINT IF EXISTS "Schedules_templateMetaId_fkey";`
      );
      console.log("✅ Constraint removida ou não existente");

      // Passo 2: Limpar valores existentes para evitar problemas de conversão
      console.log("🧹 Limpando valores existentes...");
      await queryInterface.sequelize.query(
        `UPDATE "Schedules" SET "templateMetaId" = NULL WHERE "templateMetaId" IS NOT NULL;`
      );

      // Passo 3: Alterar o tipo da coluna para STRING (VARCHAR)
      console.log("🔄 Alterando tipo da coluna para VARCHAR...");
      await queryInterface.changeColumn("Schedules", "templateMetaId", {
        type: DataTypes.STRING,
        allowNull: true
      });

      console.log("✅ Migração concluída com sucesso!");
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Erro na migração:", error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      // Não recomendado fazer downgrade neste caso, pois pode causar perda de dados
      console.log("🔄 Iniciando reversão da migração (não recomendado)");
      
      // Remover constraint primeiro
      await queryInterface.sequelize.query(
        `ALTER TABLE "Schedules" DROP CONSTRAINT IF EXISTS "Schedules_templateMetaId_fkey";`
      );
      
      // Limpar valores que possam causar problemas
      await queryInterface.sequelize.query(
        `UPDATE "Schedules" SET "templateMetaId" = NULL WHERE "templateMetaId" IS NOT NULL;`
      );
      
      // Alterar de volta para INTEGER
      await queryInterface.changeColumn("Schedules", "templateMetaId", {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      
      console.log("✅ Reversão concluída com sucesso!");
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Erro na reversão:", error);
      return Promise.reject(error);
    }
  }
};
