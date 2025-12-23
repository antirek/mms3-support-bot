/**
 * Хелпер для оптимизации промптов: сокращение примеров, компактный JSON, удаление дублирования
 */

/**
 * Оптимизация намерений для промпта
 * @param {Array} intents - Список намерений
 * @param {Object} options - Опции оптимизации
 * @param {number} options.maxExamples - Максимум примеров на намерение (по умолчанию 2)
 * @param {number} options.maxFieldExamples - Максимум примеров на поле (по умолчанию 2)
 * @returns {Array} Оптимизированные намерения
 */
export function optimizeIntentsForPrompt(intents, options = {}) {
  const maxExamples = options.maxExamples || 2;
  const maxFieldExamples = options.maxFieldExamples || 2;
  
  return intents.map(intent => {
    const optimized = {
      intent: intent.intent,
      description: intent.description,
    };
    
    // Сокращаем примеры намерения (оставляем только первые N)
    if (intent.examples && intent.examples.length > 0) {
      optimized.examples = intent.examples.slice(0, maxExamples);
    }
    
    // Оптимизируем поля данных
    if (intent.data && intent.data.length > 0) {
      optimized.data = intent.data.map(field => {
        const optimizedField = {
          field: field.field,
          description: field.description,
          required: field.required,
        };
        
        // Сокращаем примеры полей (оставляем только первые N)
        if (field.examples && field.examples.length > 0) {
          optimizedField.examples = field.examples.slice(0, maxFieldExamples);
        }
        
        return optimizedField;
      });
    }
    
    return optimized;
  });
}

/**
 * Преобразование намерений в компактный JSON для промпта
 * @param {Array} intents - Список намерений (оптимизированных или нет)
 * @returns {string} Компактный JSON строка
 */
export function intentsToCompactJson(intents) {
  return JSON.stringify(intents);
}

/**
 * Оптимизация промпта: сокращение примеров и компактный JSON
 * @param {Array} intents - Список намерений
 * @param {Object} options - Опции оптимизации
 * @returns {string} Компактный JSON строка с оптимизированными намерениями
 */
export function optimizePromptData(intents, options = {}) {
  const optimized = optimizeIntentsForPrompt(intents, options);
  return intentsToCompactJson(optimized);
}

