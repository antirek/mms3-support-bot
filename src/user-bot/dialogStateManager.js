import { Chat3UserBotClient } from './chat3Client.js';
import { DialogMetaManager } from './dialogMetaManager.js';
import { config } from './config.js';

/**
 * Менеджер состояния диалога
 */
export class DialogStateManager {
  constructor() {
    this.chat3Client = null;
    this.metaManager = null;
  }

  /**
   * Установка клиента Chat3 API
   * @param {Chat3UserBotClient} client - Экземпляр клиента
   */
  setChat3Client(client) {
    this.chat3Client = client;
  }

  /**
   * Установка менеджера мета тегов
   * @param {DialogMetaManager} metaManager - Экземпляр менеджера
   */
  setMetaManager(metaManager) {
    this.metaManager = metaManager;
  }

  /**
   * Получить состояние диалога (вычисляется динамически)
   * @param {string} dialogId - ID диалога
   * @returns {Promise<Object>}
   */
  async getDialogState(dialogId) {
    try {
      const [category, botHandling, lastIntent, conversationId] = await Promise.all([
        this.metaManager.getCategory(dialogId),
        this.metaManager.isBotHandling(dialogId),
        this.metaManager.getLastIntent(dialogId),
        this.metaManager.getBotConversationId(dialogId),
      ]);

      return {
        success: true,
        data: {
          category,
          botHandling,
          lastIntent,
          conversationId,
        }
      };
    } catch (error) {
      console.error(`Ошибка при получении состояния диалога ${dialogId}:`, error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Определить, нужно ли задавать вопрос пользователю
   * @param {string} dialogId - ID диалога
   * @param {Object} intentResult - Результат классификации намерения
   * @returns {Promise<boolean>}
   */
  async shouldAskQuestion(dialogId, intentResult) {
    try {
      // Если статус insufficient_data, нужно задать вопрос
      if (intentResult.status === 'insufficient_data') {
        // Проверяем, не превышен ли лимит вопросов
        const questionsHistory = await this.getQuestionsHistory(dialogId);
        const questionsCount = questionsHistory.length;
        
        if (questionsCount >= config.bot.maxQuestions) {
          console.log(`Достигнут лимит вопросов (${config.bot.maxQuestions}) для диалога ${dialogId}`);
          return false;
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error(`Ошибка при определении необходимости вопроса:`, error);
      return false;
    }
  }

  /**
   * Сформировать вопрос на основе недостающих данных
   * @param {Object} intentResult - Результат классификации намерения
   * @returns {string}
   */
  buildQuestion(intentResult) {
    if (intentResult.status !== 'insufficient_data') {
      return null;
    }

    const missingFields = intentResult.data?.missing_required_fields || [];
    const comment = intentResult.data?.comment;

    if (comment) {
      return comment;
    }

    if (missingFields.length === 0) {
      return 'Мне нужна дополнительная информация. Пожалуйста, уточните ваш запрос.';
    }

    const fieldsText = missingFields.join(', ');
    return `Для обработки вашего запроса мне нужна дополнительная информация: ${fieldsText}. Пожалуйста, предоставьте эти данные.`;
  }

  /**
   * Получить историю вопросов из сообщений с мета тегом botQuestion
   * @param {string} dialogId - ID диалога
   * @returns {Promise<Array>}
   */
  async getQuestionsHistory(dialogId) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      // Получаем все сообщения с мета тегом botQuestion
      const result = await this.chat3Client.getMessagesByMeta(dialogId, 'botQuestion', true, 50);
      
      if (!result.success) {
        return [];
      }

      // Сортируем по времени создания
      const questions = result.data.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeA - timeB; // По возрастанию
      });

      return questions;
    } catch (error) {
      console.error(`Ошибка при получении истории вопросов для диалога ${dialogId}:`, error);
      return [];
    }
  }

  /**
   * Получить сообщения диалога для контекста AI
   * @param {string} dialogId - ID диалога
   * @param {number} limit - Количество сообщений
   * @returns {Promise<Array>}
   */
  async getDialogMessagesForContext(dialogId, limit = 10) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const result = await this.chat3Client.getDialogMessages(dialogId, limit, { createdAt: -1 });
      
      if (!result.success) {
        return [];
      }

      // Сортируем по времени создания (старые первыми для контекста)
      const messages = result.data.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeA - timeB;
      });

      return messages;
    } catch (error) {
      console.error(`Ошибка при получении сообщений для контекста:`, error);
      return [];
    }
  }

  /**
   * Получить все сообщения диалога уточнения (вопросы бота + ответы пользователя)
   * @param {string} dialogId - ID диалога
   * @param {string} conversationId - Идентификатор сессии
   * @returns {Promise<Array>}
   */
  async getBotConversationMessages(dialogId, conversationId) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const result = await this.chat3Client.getBotConversationMessages(dialogId, conversationId, 50);
      
      if (!result.success) {
        return [];
      }

      return result.data;
    } catch (error) {
      console.error(`Ошибка при получении сообщений диалога уточнения:`, error);
      return [];
    }
  }

  /**
   * Создать новый идентификатор сессии диалога уточнения
   * @param {string} dialogId - ID диалога
   * @returns {string}
   */
  createBotConversationId(dialogId) {
    // Генерируем уникальный ID на основе dialogId и timestamp
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `conv_${dialogId}_${timestamp}_${random}`;
  }

  /**
   * Получить текущий идентификатор сессии диалога уточнения
   * @param {string} dialogId - ID диалога
   * @returns {Promise<string|null>}
   */
  async getBotConversationId(dialogId) {
    try {
      return await this.metaManager.getBotConversationId(dialogId);
    } catch (error) {
      return null;
    }
  }
}

