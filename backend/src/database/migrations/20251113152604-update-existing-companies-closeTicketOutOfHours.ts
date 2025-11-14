import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Atualizar todas as empresas existentes para ter o valor padrão true
    await queryInterface.sequelize.query(`
      UPDATE "CompaniesSettings" 
      SET "closeTicketOutOfHours" = true 
      WHERE "closeTicketOutOfHours" IS NULL
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    // Reverter a alteração
    await queryInterface.sequelize.query(`
      UPDATE "CompaniesSettings" 
      SET "closeTicketOutOfHours" = NULL 
      WHERE "closeTicketOutOfHours" = true
    `);
  }
};
