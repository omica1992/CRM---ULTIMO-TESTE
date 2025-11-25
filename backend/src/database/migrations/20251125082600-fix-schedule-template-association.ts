import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      console.log("🔄 Iniciando migração para corrigir associação Schedule-Template");

      // Verificar se a função cast_to_int_safe existe
      console.log("🔍 Verificando existência da função cast_to_int_safe");
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
        $$ LANGUAGE plpgsql IMMUTABLE;
      `);
      console.log("✅ Função cast_to_int_safe criada/atualizada");

      // Criar índice para otimizar consultas
      console.log("🔍 Criando índice para otimização de consultas");
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_schedules_templatemetaid_cast 
        ON "Schedules" (cast_to_int_safe("templateMetaId"));
      `);
      console.log("✅ Índice criado/verificado");

      console.log("✅ Migração concluída com sucesso!");
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Erro na migração:", error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      console.log("🔄 Iniciando reversão da migração");
      
      // Remover índice
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS idx_schedules_templatemetaid_cast;
      `);
      console.log("✅ Índice removido");
      
      console.log("✅ Reversão concluída com sucesso!");
      return Promise.resolve();
    } catch (error) {
      console.error("❌ Erro na reversão:", error);
      return Promise.reject(error);
    }
  }
};
