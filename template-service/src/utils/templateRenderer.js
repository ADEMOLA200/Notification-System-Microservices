const Handlebars = require('handlebars');
const logger = require('./logger');

class TemplateRenderer {
  constructor() {
    this.registerHelpers();
  }

  registerHelpers() {
    Handlebars.registerHelper('uppercase', (str) => {
      return str ? str.toUpperCase() : '';
    });

    Handlebars.registerHelper('lowercase', (str) => {
      return str ? str.toLowerCase() : '';
    });

    Handlebars.registerHelper('formatDate', (date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString();
    });
  }

  render(templateContent, variables) {
    try {
      const template = Handlebars.compile(templateContent);
      return template(variables);
    } catch (error) {
      logger.error('Template rendering failed', { error: error.message });
      throw new Error(`Template rendering error: ${error.message}`);
    }
  }

  validateVariables(templateContent, providedVariables) {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const requiredVariables = new Set();
    let match;

    while ((match = variablePattern.exec(templateContent)) !== null) {
      const varName = match[1].trim().split(' ')[0];
      if (!varName.startsWith('#') && !varName.startsWith('/')) {
        requiredVariables.add(varName);
      }
    }

    const missingVariables = [];
    requiredVariables.forEach(varName => {
      if (!(varName in providedVariables)) {
        missingVariables.push(varName);
      }
    });

    return {
      valid: missingVariables.length === 0,
      missing_variables: missingVariables
    };
  }

  extractVariables(templateContent) {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables = new Set();
    let match;

    while ((match = variablePattern.exec(templateContent)) !== null) {
      const varName = match[1].trim().split(' ')[0];
      if (!varName.startsWith('#') && !varName.startsWith('/')) {
        variables.add(varName);
      }
    }

    return Array.from(variables);
  }
}

module.exports = new TemplateRenderer();
