import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. Remover valor padrão primeiro
    await queryInterface.sequelize.query(`
      ALTER TABLE "Schedules" 
      ALTER COLUMN "templateMetaId" 
      DROP DEFAULT;
    `);

    // 2. Atualizar valores vazios para NULL
    await queryInterface.sequelize.query(`
      UPDATE "Schedules" 
      SET "templateMetaId" = NULL 
      WHERE "templateMetaId" = '' OR "templateMetaId" IS NULL;
    `);

    // 3. Converter templateMetaId de STRING para INTEGER
    await queryInterface.sequelize.query(`
      ALTER TABLE "Schedules" 
      ALTER COLUMN "templateMetaId" 
      TYPE INTEGER USING 
        CASE 
          WHEN "templateMetaId" ~ '^[0-9]+$' THEN "templateMetaId"::INTEGER
          ELSE NULL
        END;
    `);

    // Adicionar foreign key
    await queryInterface.sequelize.query(`
      ALTER TABLE "Schedules"
      ADD CONSTRAINT "Schedules_templateMetaId_fkey"
      FOREIGN KEY ("templateMetaId")
      REFERENCES "QuickMessages" ("id")
      ON UPDATE CASCADE
      ON DELETE SET NULL;
    `);
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
