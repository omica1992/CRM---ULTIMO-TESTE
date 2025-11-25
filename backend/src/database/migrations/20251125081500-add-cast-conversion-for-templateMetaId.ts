import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      console.log("🔄 Iniciando migração para adicionar função de conversão segura");

      // Adicionar função de conversão segura
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION cast_to_int_safe(v_input text)
        RETURNS INTEGER AS $$
        BEGIN
            BEGIN
                RETURN v_input::INTEGER;
            EXCEPTION WHEN OTHERS THEN
                RETURN NULL;
            END;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE; -- ✅ CORREÇÃO: Declarar como IMMUTABLE para uso em índices
      `);
      console.log("✅ Função cast_to_int_safe criada");

      // Criar índices para melhorar performance
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_schedules_templatemetaid ON "Schedules" ("templateMetaId");
      `);
      console.log("✅ Índice em templateMetaId criado");

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_schedules_templatemetaid_int ON "Schedules" (cast_to_int_safe("templateMetaId"));
      `);
      console.log("✅ Índice com conversão criado");

      console.log("✅ Migração concluída com sucesso!");
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Erro na migração:", error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      console.log("🔄 Removendo índices e função de conversão");
      
      // Remover índices
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS idx_schedules_templatemetaid;
      `);
      
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS idx_schedules_templatemetaid_int;
      `);
      
      // Remover função
      await queryInterface.sequelize.query(`
        DROP FUNCTION IF EXISTS cast_to_int_safe;
      `);
      
      console.log("✅ Remoção concluída");
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Erro na remoção:", error);
      return Promise.reject(error);
    }
  }
};
