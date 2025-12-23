import axios from 'axios';
import { config } from './config.js';

/**
 * Простая реализация Chat3Client на основе документации API
 * Используется, если пакет chat3-client недоступен
 */
export class Chat3Client {
  constructor(options) {
    this.baseURL = options.baseURL;
    this.apiKey = options.apiKey;
    this.tenantId = options.tenantId || 'tnt_default';
    this.debug = options.debug || false;

    // Создаем axios instance с базовыми настройками
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-API-Key': this.apiKey,
        'X-Tenant-ID': this.tenantId,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Получить пользователя по userId
   * GET /api/users/:userId
   */
  async getUser(userId) {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return response.data.data || response.data;
    } catch (error) {
      if (error.response) {
        throw error;
      }
      throw new Error(`Ошибка при получении пользователя: ${error.message}`);
    }
  }

  /**
   * Создать пользователя
   * POST /api/users
   */
  async createUser(userId, userData) {
    try {
      const response = await this.client.post('/users', {
        userId: userId,
        ...userData,
      });
      return response.data.data || response.data;
    } catch (error) {
      if (error.response) {
        throw error;
      }
      throw new Error(`Ошибка при создании пользователя: ${error.message}`);
    }
  }

  /**
   * Создать сообщение в диалоге
   * POST /api/dialogs/:dialogId/messages
   */
  async createMessage(dialogId, messageData) {
    try {
      const response = await this.client.post(`/dialogs/${dialogId}/messages`, messageData);
      return response.data.data || response.data;
    } catch (error) {
      if (error.response) {
        throw error;
      }
      throw new Error(`Ошибка при создании сообщения: ${error.message}`);
    }
  }
}

