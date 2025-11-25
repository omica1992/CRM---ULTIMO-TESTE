/**
 * Script para aplicar correção imediata ao problema de JOIN entre 
 * Schedule.templateMetaId (VARCHAR) e QuickMessage.id (INTEGER)
 * 
 * Este script cria uma função literal SQL para usar nas queries
 */

const { Op, literal } = require("sequelize");
const Schedule = require("../models/Schedule");

// Patching the model's default scope and associations
const applyFixes = () => {
  console.log('[SCHEDULE FIX] Applying fixes to Schedule model associations...');
  
  try {
    // 1. Override the default association logic for templateMetaId
    const templateAssociation = Schedule.associations.template;
    if (templateAssociation) {
      // Store original method
      const originalIncludeOptions = templateAssociation.manyFromSource.prepareAssociationOptionsForInclude;
      
      // Override the method to add casting in the ON clause
      templateAssociation.manyFromSource.prepareAssociationOptionsForInclude = function(options) {
        const result = originalIncludeOptions.call(this, options);
        
        // Add explicit cast in the ON condition
        if (result.on && !result.on.cast_applied) {
          const originalOn = result.on;
          result.on = literal(`cast_to_int_safe("Schedule"."templateMetaId") = "template"."id"`);
          result.on.cast_applied = true;
        }
        
        return result;
      };
      
      console.log('[SCHEDULE FIX] Template association patched successfully');
    } else {
      console.log('[SCHEDULE FIX] Warning: template association not found');
    }
    
    console.log('[SCHEDULE FIX] Fixes applied successfully');
    return true;
  } catch (error) {
    console.error('[SCHEDULE FIX] Error applying fixes:', error);
    return false;
  }
};

// Export for use in server.ts
module.exports = { applyFixes };
