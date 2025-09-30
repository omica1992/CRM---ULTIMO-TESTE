// src/database/migrations/20250816000000-add-empresa-cpf-to-contacts.ts
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Adicionar campo empresa à tabela Contacts
    await queryInterface.addColumn("Contacts", "empresa", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });

    // Adicionar campo cpf à tabela Contacts
    await queryInterface.addColumn("Contacts", "cpf", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });

    // Adicionar índices para melhor performance
    await queryInterface.addIndex("Contacts", ["empresa"], {
      name: "idx_contacts_empresa"
    });

    await queryInterface.addIndex("Contacts", ["cpf"], {
      name: "idx_contacts_cpf"
    });

    await queryInterface.addIndex("Contacts", ["empresa", "companyId"], {
      name: "idx_contacts_empresa_company"
    });

    await queryInterface.addIndex("Contacts", ["cpf", "companyId"], {
      name: "idx_contacts_cpf_company"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Remover índices
    await queryInterface.removeIndex("Contacts", "idx_contacts_empresa");
    await queryInterface.removeIndex("Contacts", "idx_contacts_cpf");
    await queryInterface.removeIndex("Contacts", "idx_contacts_empresa_company");
    await queryInterface.removeIndex("Contacts", "idx_contacts_cpf_company");

    // Remover colunas
    await queryInterface.removeColumn("Contacts", "empresa");
    await queryInterface.removeColumn("Contacts", "cpf");
  }
};
