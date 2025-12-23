import { config } from './config.js';
import { AuthClient, ApiClient } from '@mobilon-dev/gigachat-api-client';

/**
 * Классификатор намерений через GigaChat AI
 */
export class AIClassifier {
  constructor() {
    this.authClient = null;
    this.apiClient = null;
    this.clientId = null;
    this.clientSecret = null;
    this.model = null;
    this.temperature = null;
    this.maxTokens = null;
    this.jwtToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Инициализация клиента GigaChat
   * @param {string} clientId - Client ID для GigaChat
   * @param {string} clientSecret - Client Secret для GigaChat
   * @param {Object} options - Опции (model, temperature, maxTokens)
   */
  init(clientId, clientSecret, options = {}) {
    try {
      if (!clientId || !clientSecret) {
        throw new Error('GigaChat Client ID и Client Secret обязательны');
      }

      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.model = options.model || config.gigachat?.model || 'GigaChat-2';
      this.temperature = options.temperature ?? (config.gigachat?.temperature ?? 0.3);
      this.maxTokens = options.maxTokens ?? (config.gigachat?.maxTokens ?? 2000);

      // Инициализируем AuthClient для получения JWT
      this.authClient = new AuthClient(clientId, clientSecret, { 
        debug: true,
        url: 'https://gigachat-auth-proxy.services.mobilon.ru',
      });
      
      console.log('AIClassifier инициализирован');
    } catch (error) {
      console.error('Ошибка при инициализации AIClassifier:', error);
      throw error;
    }
  }

  /**
   * Получить JWT токен (с кэшированием и обновлением при необходимости)
   * @returns {Promise<string>}
   */
  async getJWTToken() {
    try {
      // Проверяем, есть ли валидный токен
      if (this.jwtToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
        return this.jwtToken;
      }

      // Получаем новый токен
      const tokenData = await this.authClient.getToken('GIGACHAT_API_PERS');
      
      if (!tokenData || !tokenData.access_token) {
        throw new Error('Не удалось получить JWT токен от GigaChat');
      }

      this.jwtToken = tokenData.access_token;
      // Токены обычно действительны 30 минут, устанавливаем срок на 25 минут для безопасности
      this.tokenExpiresAt = Date.now() + (25 * 60 * 1000);

      // Инициализируем ApiClient с новым токеном
      this.apiClient = new ApiClient(this.jwtToken, {
        debug: true,
        url: 'https://gigachat-service-proxy.services.mobilon.ru',
      });

      console.log('JWT токен GigaChat получен');
      return this.jwtToken;
    } catch (error) {
      console.error('Ошибка при получении JWT токена:', error);
      throw error;
    }
  }

  /**
   * Построение системного промпта согласно action-spec
   * @param {Array} intents - Список намерений
   * @returns {string}
   */
  buildSystemPrompt(intents) {
    const intentsJson = JSON.stringify(intents, null, 2);
    
    return `Ты - ассистент для классификации намерений пользователя. Твоя задача - проанализировать запрос пользователя и определить его намерение из списка доступных намерений.

СПИСОК ДОСТУПНЫХ НАМЕРЕНИЙ:
${intentsJson}

ПРАВИЛА КЛАССИФИКАЦИИ:
1. Сопоставь запрос пользователя с одним из доступных намерений
2. Если намерение определено, извлеки данные согласно структуре намерения
3. Проверь наличие всех обязательных полей (required: true)
4. Верни результат в формате JSON

ФОРМАТ ОТВЕТА:
Ответ должен быть валидным JSON объектом со следующей структурой:
{
  "status": "<статус>",
  "intent": "<идентификатор_намерения>",
  "data": { ... }
}

СТАТУСЫ:
- "success": намерение определено и все обязательные данные присутствуют
- "insufficient_data": намерение определено, но отсутствуют обязательные поля
- "unknown_intent": намерение не может быть определено (используй дефолтное намерение)

ПРАВИЛА:
- Используй только намерения из предоставленного списка
- Если намерение не найдено, используй дефолтное намерение (intent: "default_intent")
- Если намерение найдено, но не хватает обязательных полей, верни status: "insufficient_data" и укажи недостающие поля в data.missing_required_fields
- Типы данных определяй из описания полей
- Валидация формата данных на твое усмотрение
- Возвращай только валидный JSON, без дополнительных комментариев
- Если запрос содержит контекст предыдущих реплик, учитывай его при классификации`;
  }

  /**
   * Построение пользовательского сообщения с контекстом
   * @param {string} userMessage - Текущее сообщение пользователя
   * @param {Array} contextMessages - История сообщений для контекста
   * @returns {string}
   */
  buildUserMessage(userMessage, contextMessages = []) {
    if (!contextMessages || contextMessages.length === 0) {
      return `Запрос пользователя: "${userMessage}"`;
    }

    // Форматируем контекст диалога
    const contextLines = contextMessages.map((msg, index) => {
      const sender = msg.senderId || 'Пользователь';
      const content = msg.content || '';
      const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '';
      return `- ${sender}: "${content}"${timestamp ? ` (${timestamp})` : ''}`;
    });

    return `Контекст диалога:
${contextLines.join('\n')}

Текущий запрос пользователя: "${userMessage}"`;
  }

  /**
   * Классификация намерения пользователя
   * @param {string} userMessage - Сообщение пользователя
   * @param {Array} contextMessages - История сообщений для контекста
   * @param {Array} intents - Список намерений
   * @returns {Promise<Object>}
   */
  async classifyIntent(userMessage, contextMessages = [], intents = []) {
    try {
      if (!this.authClient) {
        throw new Error('GigaChat AuthClient не инициализирован');
      }

      // Получаем JWT токен (с автоматическим обновлением при необходимости)
      await this.getJWTToken();

      if (!this.apiClient) {
        throw new Error('GigaChat ApiClient не инициализирован');
      }

      const systemPrompt = this.buildSystemPrompt(intents);
      const userPrompt = this.buildUserMessage(userMessage, contextMessages);

      // Формируем сообщения для GigaChat API
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      // Отправляем запрос к GigaChat API
      const response = await this.apiClient.sendRequest(this.model, messages);

      // Парсим ответ
      const parsed = await this.parseAIResponse(response);
      return parsed;
    } catch (error) {
      console.error('Ошибка при классификации намерения:', error);
      
      // При ошибке аутентификации пытаемся обновить токен и повторить запрос
      if (error.message && (error.message.includes('401') || error.message.includes('token') || error.message.includes('auth'))) {
        console.log('Попытка обновить JWT токен и повторить запрос...');
        try {
          this.jwtToken = null;
          this.tokenExpiresAt = null;
          await this.getJWTToken();
          
          // Повторяем запрос
          const systemPrompt = this.buildSystemPrompt(intents);
          const userPrompt = this.buildUserMessage(userMessage, contextMessages);
          const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ];
          const response = await this.apiClient.sendRequest(this.model, messages);
          const parsed = await this.parseAIResponse(response);
          return parsed;
        } catch (retryError) {
          console.error('Ошибка при повторной попытке:', retryError);
        }
      }

      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: { comment: 'Ошибка при классификации намерения' },
        error: error.message || String(error)
      };
    }
  }

  /**
   * Парсинг ответа AI (JSON)
   * @param {Object|string} response - Ответ от AI
   * @returns {Promise<Object>}
   */
  async parseAIResponse(response) {
    try {
      let jsonData;

      // Обрабатываем разные форматы ответа от GigaChat API
      if (typeof response === 'string') {
        // Если ответ - строка, пытаемся распарсить JSON
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.choices && response.choices[0] && response.choices[0].message) {
        // Формат OpenAI-style (choices[0].message.content)
        const content = response.choices[0].message.content;
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.choices && response.choices[0] && response.choices[0].text) {
        // Альтернативный формат (choices[0].text)
        const content = response.choices[0].text;
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.content) {
        // Прямой формат с content
        const cleaned = response.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.message) {
        // Формат с message
        const cleaned = response.message.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        jsonData = JSON.parse(cleaned);
      } else if (response.data) {
        // Формат с data
        jsonData = response.data;
      } else {
        // Уже объект или другой формат
        jsonData = response;
      }

      // Валидация ответа
      const validated = this.validateIntentResponse(jsonData);
      return validated;
    } catch (error) {
      console.error('Ошибка при парсинге ответа AI:', error);
      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: { comment: 'Ошибка при обработке ответа AI' },
        error: error.message || String(error)
      };
    }
  }

  /**
   * Валидация ответа классификации
   * @param {Object} response - Ответ от AI
   * @returns {Object}
   */
  validateIntentResponse(response) {
    // Проверяем обязательные поля
    if (!response.status || !response.intent) {
      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: { comment: 'Некорректный формат ответа AI' },
        error: 'Отсутствуют обязательные поля status или intent'
      };
    }

    // Проверяем валидность статуса
    const validStatuses = ['success', 'insufficient_data', 'unknown_intent'];
    if (!validStatuses.includes(response.status)) {
      return {
        success: false,
        status: 'unknown_intent',
        intent: 'default_intent',
        data: { comment: 'Некорректный статус ответа' },
        error: `Неизвестный статус: ${response.status}`
      };
    }

    // Проверяем наличие data
    if (!response.data || typeof response.data !== 'object') {
      response.data = {};
    }

    // Если insufficient_data, проверяем наличие missing_required_fields
    if (response.status === 'insufficient_data') {
      if (!Array.isArray(response.data.missing_required_fields)) {
        response.data.missing_required_fields = [];
      }
    }

    return {
      success: true,
      status: response.status,
      intent: response.intent,
      data: response.data
    };
  }
}

