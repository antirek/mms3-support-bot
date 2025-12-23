import { config } from './config.js';
import { AuthClient, ApiClient } from '@mobilon-dev/gigachat-api-client';
import { optimizeIntentsForPrompt, intentsToCompactJson } from './promptOptimizer.js';

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
    this.topP = null;
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
      this.model = options.model || config.gigachat?.model || 'GigaChat-2-Max';
      // Низкая температура (0.1) для более точной классификации намерений
      this.temperature = options.temperature ?? (config.gigachat?.temperature ?? 0.1);
      this.maxTokens = options.maxTokens ?? (config.gigachat?.maxTokens ?? 1500);
      // Top-p для более структурированных ответов
      this.topP = options.topP ?? (config.gigachat?.topP ?? 0.1);

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
   * @param {Object} options - Опции оптимизации промпта
   * @returns {string}
   */
  buildSystemPrompt(intents, options = {}) {
    // Оптимизируем намерения перед добавлением в промпт
    const optimizedIntents = optimizeIntentsForPrompt(intents, {
      maxExamples: options.maxExamples || 2,
      maxFieldExamples: options.maxFieldExamples || 2,
    });
    
    // Компактный JSON (без отступов)
    const intentsJson = intentsToCompactJson(optimizedIntents);
    
    return `Ты - ассистент для классификации намерений пользователя. Твоя задача - проанализировать запрос пользователя и определить его намерение из списка доступных намерений.

СПИСОК ДОСТУПНЫХ НАМЕРЕНИЙ:
${intentsJson}

## ЗАДАЧА

1. Определи намерение из списка
2. Извлеки данные согласно структуре намерения
3. **КРИТИЧЕСКИ ВАЖНО:** Проверь ВСЕ обязательные поля (required: true)
4. Верни JSON: {"status":"<статус>","intent":"<id>","data":{...}}

## СТАТУСЫ

- "success": намерение определено И все обязательные поля присутствуют
- "insufficient_data": намерение определено, но отсутствует хотя бы одно обязательное поле
- "unknown_intent": намерение не определено → используй "default_intent"

## ПРАВИЛА

1. **Проверка обязательных полей:**
   - После определения намерения проверь все поля с required: true
   - Если хотя бы одно отсутствует → status: "insufficient_data"
   - НЕ возвращай "success" если отсутствуют обязательные поля

2. **Извлечение данных:**
   - Извлекай из запроса и контекста диалога
   - Если значение не найдено → поле отсутствует
   - Не придумывай значения для обязательных полей

3. **insufficient_data:**
   - В data.missing_required_fields укажи массив недостающих полей
   - В data.comment (опционально) укажи человекочитаемое сообщение

4. **Классификация:**
   - Используй description и examples для сопоставления
   - Учитывай контекст диалога
   - Если намерение не найдено → "unknown_intent", "default_intent"

## ПРИМЕРЫ

Пример 1 (success): Запрос: "Не работает мобильное приложение, ошибка авторизации"
Результат: {"status":"success","intent":"support_technical","data":{"issue_type":"авторизация","device":"мобильное приложение"}}

Пример 2 (insufficient_data): Запрос: "У меня не работает"
Результат: {"status":"insufficient_data","intent":"support_technical","data":{"missing_required_fields":["device","issue_type"],"comment":"Необходимо указать устройство и тип проблемы"}}

## ДОПОЛНИТЕЛЬНО

- Используй ТОЛЬКО намерения из списка
- Типы данных определяй из description полей
- Возвращай только валидный JSON, без markdown
- Учитывай контекст диалога при классификации
- Не включай null/undefined для обязательных полей`;
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

      // Параметры для более точной классификации:
      // - низкая температура (0.1) - более детерминированные ответы
      // - низкий top_p (0.1) - более структурированные ответы
      // - достаточный max_tokens для JSON ответа
      const requestOptions = {
        temperature: this.temperature,
        top_p: this.topP,
        max_tokens: this.maxTokens,
      };

      // Отправляем запрос к GigaChat API
      const response = await this.apiClient.sendRequest(this.model, messages, requestOptions);

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
          const requestOptions = {
            temperature: this.temperature,
            top_p: this.topP,
            max_tokens: this.maxTokens,
          };
          const response = await this.apiClient.sendRequest(this.model, messages, requestOptions);
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

