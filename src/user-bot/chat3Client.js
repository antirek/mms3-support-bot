// Используем локальную реализацию Chat3Client
// Если пакет chat3-client установлен, можно заменить импорт
import { Chat3Client } from './chat3ClientImpl.js';
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

      console.log(`Сообщение отправлено в диалог ${dialogId}: ${content}`);
      return { success: true, data: result };
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
}

