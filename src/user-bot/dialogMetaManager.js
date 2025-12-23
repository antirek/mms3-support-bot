import { Chat3UserBotClient } from './chat3Client.js';

/**
 * Менеджер для работы с мета тегами диалогов и сообщений
 */
export class DialogMetaManager {
  constructor() {
    this.chat3Client = null;
  }

  /**
   * Установка клиента Chat3 API
   * @param {Chat3UserBotClient} client - Экземпляр клиента
   */
  setChat3Client(client) {
    this.chat3Client = client;
  }

  /**
   * Получить все мета теги диалога
   * @param {string} dialogId - ID диалога
   * @returns {Promise<Object>}
   */
  async getDialogMeta(dialogId) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const client = this.chat3Client.getClient();
      // Используем метод getMeta из chat3-client
      // GET /api/meta/dialog/:dialogId
      const response = await client.getMeta('dialog', dialogId);

      return { success: true, data: response?.data || response || {} };
    } catch (error) {
      console.error(`Ошибка при получении мета тегов диалога ${dialogId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Получить конкретный мета тег диалога
   * @param {string} dialogId - ID диалога
   * @param {string} key - Ключ мета тега
   * @returns {Promise<Object>}
   */
  async getDialogMetaKey(dialogId, key) {
    try {
      const allMeta = await this.getDialogMeta(dialogId);
      if (!allMeta.success) {
        return allMeta;
      }

      const value = allMeta.data[key]?.value || allMeta.data[key];
      return { success: true, data: value };
    } catch (error) {
      console.error(`Ошибка при получении мета тега ${key} диалога ${dialogId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Установить мета тег диалога
   * @param {string} dialogId - ID диалога
   * @param {string} key - Ключ мета тега
   * @param {*} value - Значение мета тега
   * @param {Object} options - Опции (dataType, scope)
   * @returns {Promise<Object>}
   */
  async setDialogMetaKey(dialogId, key, value, options = {}) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const client = this.chat3Client.getClient();
      // Используем метод setMeta из chat3-client
      // PUT /api/meta/dialog/:dialogId/:key
      const metaValue = {
        value: value,
        ...(options.dataType && { dataType: options.dataType }),
        ...(options.scope && { scope: options.scope }),
      };

      const response = await client.setMeta('dialog', dialogId, key, metaValue);

      return { success: true, data: response?.data || response };
    } catch (error) {
      console.error(`Ошибка при установке мета тега ${key} диалога ${dialogId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Проверить наличие категории диалога
   * @param {string} dialogId - ID диалога
   * @returns {Promise<boolean>}
   */
  async hasCategory(dialogId) {
    try {
      const result = await this.getDialogMetaKey(dialogId, 'category');
      return result.success && result.data !== null && result.data !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получить категорию диалога
   * @param {string} dialogId - ID диалога
   * @returns {Promise<string|null>}
   */
  async getCategory(dialogId) {
    try {
      const result = await this.getDialogMetaKey(dialogId, 'category');
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Установить категорию диалога
   * @param {string} dialogId - ID диалога
   * @param {string} category - Категория
   * @returns {Promise<Object>}
   */
  async setCategory(dialogId, category) {
    return await this.setDialogMetaKey(dialogId, 'category', category, { dataType: 'string' });
  }

  /**
   * Проверить, ведет ли бот диалог
   * @param {string} dialogId - ID диалога
   * @returns {Promise<boolean>}
   */
  async isBotHandling(dialogId) {
    try {
      const result = await this.getDialogMetaKey(dialogId, 'botHandling');
      if (result.success && result.data !== null && result.data !== undefined) {
        return Boolean(result.data);
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Установить флаг ведения диалога ботом
   * @param {string} dialogId - ID диалога
   * @param {boolean} isHandling - Флаг ведения
   * @returns {Promise<Object>}
   */
  async setBotHandling(dialogId, isHandling) {
    return await this.setDialogMetaKey(dialogId, 'botHandling', isHandling, { dataType: 'boolean' });
  }

  /**
   * Получить последнее намерение
   * @param {string} dialogId - ID диалога
   * @returns {Promise<string|null>}
   */
  async getLastIntent(dialogId) {
    try {
      const result = await this.getDialogMetaKey(dialogId, 'lastIntent');
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Установить последнее намерение
   * @param {string} dialogId - ID диалога
   * @param {string} intent - Намерение
   * @returns {Promise<Object>}
   */
  async setLastIntent(dialogId, intent) {
    return await this.setDialogMetaKey(dialogId, 'lastIntent', intent, { dataType: 'string' });
  }

  /**
   * Получить идентификатор текущей сессии диалога уточнения
   * @param {string} dialogId - ID диалога
   * @returns {Promise<string|null>}
   */
  async getBotConversationId(dialogId) {
    try {
      const result = await this.getDialogMetaKey(dialogId, 'botConversationId');
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Установить идентификатор сессии диалога уточнения
   * @param {string} dialogId - ID диалога
   * @param {string} conversationId - Идентификатор сессии
   * @returns {Promise<Object>}
   */
  async setBotConversationId(dialogId, conversationId) {
    return await this.setDialogMetaKey(dialogId, 'botConversationId', conversationId, { dataType: 'string' });
  }

  // Методы для работы с мета тегами сообщений

  /**
   * Получить мета тег сообщения
   * @param {string} messageId - ID сообщения
   * @param {string} key - Ключ мета тега
   * @returns {Promise<Object>}
   */
  async getMessageMeta(messageId, key) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const client = this.chat3Client.getClient();
      // Используем метод getMeta из chat3-client
      // GET /api/meta/message/:messageId
      const response = await client.getMeta('message', messageId);

      const allMeta = response?.data || response || {};
      const value = allMeta[key]?.value || allMeta[key];
      
      return { success: true, data: value };
    } catch (error) {
      console.error(`Ошибка при получении мета тега ${key} сообщения ${messageId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Установить мета тег сообщения
   * @param {string} messageId - ID сообщения
   * @param {string} key - Ключ мета тега
   * @param {*} value - Значение мета тега
   * @param {Object} options - Опции (dataType, scope)
   * @returns {Promise<Object>}
   */
  async setMessageMetaKey(messageId, key, value, options = {}) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const client = this.chat3Client.getClient();
      // Используем метод setMeta из chat3-client
      // PUT /api/meta/message/:messageId/:key
      const metaValue = {
        value: value,
        ...(options.dataType && { dataType: options.dataType }),
        ...(options.scope && { scope: options.scope }),
      };

      const response = await client.setMeta('message', messageId, key, metaValue);

      return { success: true, data: response?.data || response };
    } catch (error) {
      console.error(`Ошибка при установке мета тега ${key} сообщения ${messageId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Проверить, является ли сообщение вопросом бота
   * @param {string} messageId - ID сообщения
   * @returns {Promise<boolean>}
   */
  async isBotQuestion(messageId) {
    try {
      const result = await this.getMessageMeta(messageId, 'botQuestion');
      if (result.success && result.data !== null && result.data !== undefined) {
        return Boolean(result.data);
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Пометить сообщение как вопрос бота
   * @param {string} messageId - ID сообщения
   * @param {string} questionType - Тип вопроса (опционально)
   * @param {string} relatedIntent - Связанное намерение (опционально)
   * @param {string} conversationId - Идентификатор сессии (опционально)
   * @returns {Promise<Object>}
   */
  async markMessageAsQuestion(messageId, questionType = null, relatedIntent = null, conversationId = null) {
    try {
      // Устанавливаем флаг botQuestion
      const result = await this.setMessageMetaKey(messageId, 'botQuestion', true, { dataType: 'boolean' });
      if (!result.success) {
        return result;
      }

      // Устанавливаем дополнительные мета теги, если указаны
      if (questionType) {
        await this.setMessageMetaKey(messageId, 'questionType', questionType, { dataType: 'string' });
      }
      if (relatedIntent) {
        await this.setMessageMetaKey(messageId, 'relatedIntent', relatedIntent, { dataType: 'string' });
      }
      if (conversationId) {
        await this.setMessageMetaKey(messageId, 'botConversationId', conversationId, { dataType: 'string' });
      }

      return { success: true };
    } catch (error) {
      console.error(`Ошибка при пометке сообщения ${messageId} как вопроса:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Пометить сообщение пользователя как ответ в диалоге с ботом
   * @param {string} messageId - ID сообщения
   * @param {string} conversationId - Идентификатор сессии
   * @returns {Promise<Object>}
   */
  async markMessageAsBotResponse(messageId, conversationId) {
    try {
      // Устанавливаем флаг botDialogResponse
      const result = await this.setMessageMetaKey(messageId, 'botDialogResponse', true, { dataType: 'boolean' });
      if (!result.success) {
        return result;
      }

      // Устанавливаем идентификатор сессии
      if (conversationId) {
        await this.setMessageMetaKey(messageId, 'botConversationId', conversationId, { dataType: 'string' });
      }

      return { success: true };
    } catch (error) {
      console.error(`Ошибка при пометке сообщения ${messageId} как ответа:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }
}

