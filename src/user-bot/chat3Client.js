import { Chat3Client } from 'chat3-client';
import { config } from './config.js'; 

/**
 * Клиент для работы с chat3 tenant-api для user-bot
 */
export class Chat3UserBotClient {
  constructor() {
    this.client = null;
  }

  /**
   * Инициализация клиента
   * @param {string} apiUrl - URL API chat3
   * @param {string} apiKey - API ключ для аутентификации
   * @param {string} tenantId - ID тенанта
   */
  init(apiUrl, apiKey, tenantId) {
    if (!apiUrl || !apiKey || !tenantId) {
      throw new Error('apiUrl, apiKey и tenantId обязательны для инициализации клиента');
    }
    
    this.client = new Chat3Client({
      baseURL: apiUrl,
      apiKey: apiKey,
      tenantId: tenantId,
      debug: false,
    });
    
    console.log(`Chat3 API клиент инициализирован для tenant: ${tenantId}`);
  }

  /**
   * Создание или получение пользователя-бота
   * @param {string} userId - ID пользователя
   * @param {string} name - Имя пользователя
   * @param {string} type - Тип пользователя (bot)
   * @returns {Promise<Object>}
   */
  async ensureUser(userId, name, type = 'bot') {
    try {
      // Пытаемся получить пользователя
      try {
        const user = await this.client.getUser(userId);
        console.log(`Пользователь ${userId} уже существует`);
        return { success: true, data: user, created: false };
      } catch (error) {
        // Если пользователь не найден, создаем его
        if (error.response && error.response.status === 404) {
          console.log(`Создание пользователя ${userId} типа ${type}...`);
          const newUser = await this.client.createUser(userId, {
            name: name,
            type: type,
          });
          console.log(`Пользователь ${userId} успешно создан`);
          return { success: true, data: newUser, created: true };
        }
        throw error;
      }
    } catch (error) {
      console.error(`Ошибка при создании/получении пользователя ${userId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Отправка сообщения в диалог
   * @param {string} dialogId - ID диалога
   * @param {string} content - Содержимое сообщения
   * @param {string} type - Тип сообщения (по умолчанию 'internal.text')
   * @returns {Promise<Object>}
   */
  async sendMessage(dialogId, content, type = 'internal.text') {
    try {
      if (!this.client) {
        throw new Error('Chat3 API клиент не инициализирован');
      }

      const { userId } = config.bot;
      
      // Отправляем сообщение от имени бота
      // Используем createMessage, который создаст сообщение от имени пользователя-бота
      const result = await this.client.createMessage(dialogId, {
        senderId: userId,
        type: type,
        content: content,
      });

      const messageData = result.data || result;
      const messageId = messageData.messageId || messageData._id || messageData.id;

      console.log(`Сообщение отправлено в диалог ${dialogId}: ${content}`, messageId ? `(messageId: ${messageId})` : '');
      return { success: true, data: messageData, messageId: messageId };
    } catch (error) {
      // Детальный вывод ошибки для Axios
      let errorDetails = {
        message: error.message || String(error),
        dialogId,
        content,
        type,
      };

      // Если это Axios ошибка, добавляем дополнительную информацию
      if (error.response) {
        errorDetails.status = error.response.status;
        errorDetails.statusText = error.response.statusText;
        errorDetails.url = error.config?.url;
        errorDetails.method = error.config?.method?.toUpperCase();
        errorDetails.responseData = error.response.data;
        errorDetails.baseURL = error.config?.baseURL;
        console.error(`Ошибка при отправке сообщения в диалог ${dialogId}:`, JSON.stringify(errorDetails, null, 2));
      } else {
        console.error(`Ошибка при отправке сообщения в диалог ${dialogId}:`, error.message || error);
      }
      
      return { success: false, error: errorDetails.message, details: errorDetails };
    }
  }

  /**
   * Получение клиента для прямого доступа к API
   * @returns {Chat3Client}
   */
  getClient() {
    if (!this.client) {
      throw new Error('Chat3 API клиент не инициализирован');
    }
    return this.client;
  }

  /**
   * Получить сообщения диалога
   * @param {string} dialogId - ID диалога
   * @param {number} limit - Количество сообщений (по умолчанию 10)
   * @param {Object} sort - Сортировка (по умолчанию по createdAt в порядке убывания)
   * @param {string} filter - Фильтр (опционально)
   * @returns {Promise<Object>}
   */
  async getDialogMessages(dialogId, limit = 10, sort = { createdAt: -1 }, filter = null) {
    try {
      if (!this.client) {
        throw new Error('Chat3 API клиент не инициализирован');
      }

      // Используем метод getDialogMessages из chat3-client
      // GET /api/dialogs/:dialogId/messages
      const params = {
        limit: limit,
        sort: JSON.stringify(sort),
      };

      if (filter) {
        params.filter = filter;
      }

      const response = await this.client.getDialogMessages(dialogId, params);

      const messages = response?.data || response || [];
      return { success: true, data: Array.isArray(messages) ? messages : [] };
    } catch (error) {
      console.error(`Ошибка при получении сообщений диалога ${dialogId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Получить сообщения диалога с фильтром по мета тегам
   * @param {string} dialogId - ID диалога
   * @param {string} metaKey - Ключ мета тега
   * @param {*} metaValue - Значение мета тега
   * @param {number} limit - Количество сообщений
   * @returns {Promise<Object>}
   */
  async getMessagesByMeta(dialogId, metaKey, metaValue, limit = 50) {
    try {
      // Формируем фильтр: (meta.{key},eq,{value})
      const filter = `(meta.${metaKey},eq,${JSON.stringify(metaValue)})`;
      return await this.getDialogMessages(dialogId, limit, { createdAt: -1 }, filter);
    } catch (error) {
      console.error(`Ошибка при получении сообщений по мета тегу ${metaKey}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Получить все сообщения диалога уточнения (вопросы бота + ответы пользователя)
   * @param {string} dialogId - ID диалога
   * @param {string} conversationId - Идентификатор сессии
   * @param {number} limit - Количество сообщений
   * @returns {Promise<Object>}
   */
  async getBotConversationMessages(dialogId, conversationId, limit = 50) {
    try {
      // Фильтр: (meta.botQuestion,eq,true)|(meta.botDialogResponse,eq,true)&(meta.botConversationId,eq,{conversationId})
      // Поскольку API может не поддерживать сложные фильтры с OR, делаем два запроса и объединяем
      const filter1 = `(meta.botQuestion,eq,true)&(meta.botConversationId,eq,${JSON.stringify(conversationId)})`;
      const filter2 = `(meta.botDialogResponse,eq,true)&(meta.botConversationId,eq,${JSON.stringify(conversationId)})`;

      const [result1, result2] = await Promise.all([
        this.getDialogMessages(dialogId, limit, { createdAt: -1 }, filter1),
        this.getDialogMessages(dialogId, limit, { createdAt: -1 }, filter2),
      ]);

      if (!result1.success && !result2.success) {
        return { success: false, error: 'Не удалось получить сообщения диалога уточнения' };
      }

      // Объединяем результаты и убираем дубликаты
      const messages1 = result1.success ? result1.data : [];
      const messages2 = result2.success ? result2.data : [];
      const allMessages = [...messages1, ...messages2];

      // Убираем дубликаты по messageId
      const uniqueMessages = Array.from(
        new Map(allMessages.map(msg => [msg.messageId || msg._id, msg])).values()
      );

      // Сортируем по createdAt
      uniqueMessages.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeA - timeB; // По возрастанию (старые первыми)
      });

      return { success: true, data: uniqueMessages };
    } catch (error) {
      console.error(`Ошибка при получении сообщений диалога уточнения:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Получить мета тег сообщения
   * @param {string} messageId - ID сообщения
   * @param {string} key - Ключ мета тега
   * @returns {Promise<Object>}
   */
  async getMessageMeta(messageId, key) {
    try {
      if (!this.client) {
        throw new Error('Chat3 API клиент не инициализирован');
      }

      // Используем метод getMeta из chat3-client
      // GET /api/meta/message/:messageId
      const response = await this.client.getMeta('message', messageId);

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
  async setMessageMeta(messageId, key, value, options = {}) {
    try {
      if (!this.client) {
        throw new Error('Chat3 API клиент не инициализирован');
      }

      // Используем метод setMeta из chat3-client
      // PUT /api/meta/message/:messageId/:key
      const metaValue = {
        value: value,
        ...(options.dataType && { dataType: options.dataType }),
        ...(options.scope && { scope: options.scope }),
      };

      const response = await this.client.setMeta('message', messageId, key, metaValue);

      return { success: true, data: response?.data || response };
    } catch (error) {
      console.error(`Ошибка при установке мета тега ${key} сообщения ${messageId}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
  }
}

