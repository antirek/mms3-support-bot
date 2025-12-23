# План реализации сценария обслуживания диалога с AI-классификацией

## Обзор

Реализация бота для автоматического обслуживания диалогов mms3 с использованием AI (GigaChat) для классификации намерений пользователя и определения категории диалога.

## Архитектура решения

### Компоненты системы

1. **MessageHandler** - обработчик входящих сообщений
2. **DialogMetaManager** - управление мета тегами диалога
3. **AIClassifier** - классификатор намерений через GigaChat
4. **DialogStateManager** - управление состоянием диалога (ведет ли бот, какие вопросы заданы)
5. **IntentConfig** - конфигурация намерений (intents) для классификации

## План реализации

### Этап 1: Инфраструктура для работы с мета тегами

**Файл:** `src/user-bot/dialogMetaManager.js`

**Задачи:**
- [ ] Создать класс `DialogMetaManager` для работы с мета тегами диалога и сообщений
- [ ] Реализовать методы для диалога:
  - `getDialogMeta(dialogId)` - получить все мета теги диалога
  - `getDialogMetaKey(dialogId, key)` - получить конкретный мета тег диалога
  - `setDialogMetaKey(dialogId, key, value, options)` - установить мета тег диалога
  - `hasCategory(dialogId)` - проверить наличие категории
  - `getCategory(dialogId)` - получить категорию диалога
  - `setCategory(dialogId, category)` - установить категорию
  - `isBotHandling(dialogId)` - проверить, ведет ли бот диалог
  - `setBotHandling(dialogId, isHandling)` - установить флаг ведения ботом
  - `getLastIntent(dialogId)` - получить последнее намерение (опционально)
  - `setLastIntent(dialogId, intent)` - установить последнее намерение
  - `getBotConversationId(dialogId)` - получить идентификатор текущей сессии диалога уточнения
  - `setBotConversationId(dialogId, conversationId)` - установить идентификатор сессии диалога уточнения
- [ ] Реализовать методы для сообщений:
  - `getMessageMeta(messageId, key)` - получить мета тег сообщения
  - `setMessageMetaKey(messageId, key, value, options)` - установить мета тег сообщения
  - `isBotQuestion(messageId)` - проверить, является ли сообщение вопросом бота
  - `markMessageAsQuestion(messageId, questionType, relatedIntent, conversationId)` - пометить сообщение как вопрос бота
  - `markMessageAsBotResponse(messageId, conversationId)` - пометить сообщение пользователя как ответ в диалоге с ботом

**Мета теги диалога:**
- `category` - категория/намерение диалога (string)
- `botHandling` - флаг, что диалог ведет бот (boolean)
- `lastIntent` - последнее определенное намерение (string, опционально)
- `botConversationId` - идентификатор текущей сессии диалога уточнения (string, опционально)

**Мета теги сообщений:**
- `botQuestion` - флаг, что сообщение является вопросом от бота (boolean)
- `questionType` - тип вопроса (string, опционально, например: "missing_field")
- `relatedIntent` - связанное намерение для вопроса (string, опционально)
- `botDialogResponse` - флаг, что сообщение пользователя является ответом в диалоге уточнения с ботом (boolean)
- `botConversationId` - идентификатор сессии диалога уточнения (string, опционально, для группировки вопросов/ответов)

**Примечание:** История сообщений и контекст диалога получаются через API mms3, не хранятся в мета тегах.

### Этап 2: Интеграция с GigaChat API

**Файл:** `src/user-bot/aiClassifier.js`

**Задачи:**
- [ ] Создать класс `AIClassifier` для работы с GigaChat
- [ ] Инициализировать клиент `@mobilon-dev/gigachat-api-client`
- [ ] Реализовать методы:
  - `classifyIntent(userMessage, context, intents)` - классификация намерения
  - `buildSystemPrompt(intents)` - построение системного промпта
  - `buildUserMessage(userMessage, context)` - построение пользовательского сообщения
  - `parseAIResponse(response)` - парсинг ответа AI (JSON)
  - `validateIntentResponse(response)` - валидация ответа

**Конфигурация:**
- API ключ GigaChat из переменных окружения
- Настройки модели (температура, max_tokens и т.д.)

### Этап 3: Конфигурация намерений

**Файл:** `src/user-bot/intentConfig.js`

**Задачи:**
- [ ] Создать конфигурацию намерений (intents) согласно action-spec
- [ ] Определить структуру намерений:
  ```javascript
  [
    {
      intent: "support_technical",
      description: "Техническая поддержка",
      examples: ["не работает", "ошибка", "не могу войти"],
      data: [
        { field: "issue_type", description: "Тип проблемы", required: true },
        { field: "device", description: "Устройство", required: true }
      ]
    },
    {
      intent: "support_billing",
      description: "Вопросы по оплате",
      examples: ["оплата", "счет", "возврат"],
      data: [...]
    },
    {
      intent: "default_intent",
      description: "Неопределенное намерение",
      data: []
    }
  ]
  ```
- [ ] Вынести конфигурацию в отдельный файл или переменные окружения

### Этап 4: Управление состоянием диалога

**Файл:** `src/user-bot/dialogStateManager.js`

**Задачи:**
- [ ] Создать класс `DialogStateManager` для управления состоянием
- [ ] Реализовать методы:
  - `getDialogState(dialogId)` - получить состояние диалога (вычисляется из мета тегов и сообщений)
  - `shouldAskQuestion(dialogId, intentResult)` - определить, нужно ли задавать вопрос
  - `buildQuestion(intentResult)` - сформировать вопрос на основе недостающих данных
  - `markMessageAsQuestion(messageId, questionType, relatedIntent)` - пометить сообщение как вопрос бота
  - `getQuestionsHistory(dialogId)` - получить историю вопросов из сообщений с мета тегом `botQuestion`
  - `getDialogMessagesForContext(dialogId, limit)` - получить сообщения диалога для контекста AI
  - `getBotConversationMessages(dialogId, conversationId)` - получить все сообщения диалога уточнения (вопросы бота + ответы пользователя) одним запросом с фильтром по мета тегам
  - `createBotConversationId(dialogId)` - создать новый идентификатор сессии диалога уточнения
  - `getBotConversationId(dialogId)` - получить текущий идентификатор сессии диалога уточнения

**Состояние диалога (вычисляется динамически):**
- Текущее намерение (из мета тега `lastIntent` или определяется заново)
- Недостающие обязательные поля (из результата AI классификации)
- История вопросов/ответов (получается через API из сообщений с мета тегом `botQuestion`)
- Флаг активного диалога с ботом (из мета тега `botHandling`)

### Этап 5: Основной обработчик сообщений

**Файл:** `src/user-bot/messageHandler.js`

**Задачи:**
- [ ] Создать класс `MessageHandler` - основной обработчик
- [ ] Реализовать метод `handleIncomingMessage(update)`:
  
  **Алгоритм обработки:**
  1. Получить сообщение и диалог из update
  2. Проверить, что сообщение не от бота
  3. Получить мета теги диалога через `DialogMetaManager`
  4. Проверить наличие категории:
     - Если категория есть → использовать существующую
     - Если категории нет → определить через AI
  5. Если категория не определена или диалог на обслуживании бота:
     - Проверить флаг `botHandling` в мета тегах диалога
     - Если `botHandling === true`:
       - Получить `botConversationId` из мета тегов диалога (или создать новый)
       - Пометить текущее сообщение пользователя мета тегом `botDialogResponse` и `botConversationId`
       - Получить все сообщения диалога уточнения одним запросом через `getBotConversationMessages(dialogId, conversationId)` с фильтром по мета тегам `botQuestion` и `botDialogResponse` (включая только что помеченное сообщение)
     - Если `botHandling === false`:
       - Получить последние N сообщений диалога через `chat3Client.getDialogMessages()`
     - Сформировать контекст для AI из полученных сообщений
     - Вызвать `AIClassifier.classifyIntent()` с контекстом
     - Сохранить категорию и намерение в мета теги диалога
  6. Обработать результат классификации:
     - Если `status === "success"` → категория определена, можно обработать
     - Если `status === "insufficient_data"` → задать вопросы пользователю
     - Если `status === "unknown_intent"` → использовать дефолтную категорию
  7. Если нужно задать вопрос:
     - Проверить флаг `botHandling` в мета тегах
     - Получить или создать `botConversationId` для текущей сессии диалога уточнения
     - Если бот ведет диалог → задать вопрос через `sendMessage()`
     - Пометить отправленное сообщение мета тегом `botQuestion` и `botConversationId` через `DialogMetaManager.markMessageAsQuestion()`
     - Установить флаг `botHandling = true` в мета тегах диалога
     - Сохранить `botConversationId` в мета тегах диалога
  8. Если получено сообщение пользователя и `botHandling === true`:
     - Пометить сообщение пользователя мета тегом `botDialogResponse` и `botConversationId` через `DialogMetaManager.markMessageAsBotResponse()`
     - Это позволит в дальнейшем получить все сообщения диалога уточнения одним запросом
  9. Если категория определена и данных достаточно:
     - Выполнить действие согласно категории (если нужно)
     - Отправить ответ пользователю
     - Установить флаг `botHandling = false` в мета тегах диалога (диалог уточнения завершен)

### Этап 6: Интеграция с существующим кодом

**Файл:** `src/user-bot/updateHandlers.js`

**Задачи:**
- [ ] Модифицировать `handleMessageUpdate()`:
  - Заменить простой ответ на вызов `MessageHandler.handleIncomingMessage()`
  - Интегрировать все компоненты
- [ ] Добавить инициализацию компонентов в `index.js`:
  - Инициализировать `DialogMetaManager`
  - Инициализировать `AIClassifier`
  - Инициализировать `DialogStateManager`
  - Инициализировать `MessageHandler`

### Этап 7: Конфигурация

**Файл:** `src/user-bot/config.js`

**Задачи:**
- [ ] Добавить настройки для GigaChat:
  - `GIGACHAT_API_KEY` - API ключ
  - `GIGACHAT_MODEL` - модель (по умолчанию)
  - `GIGACHAT_TEMPERATURE` - температура
  - `GIGACHAT_MAX_TOKENS` - максимальное количество токенов
- [ ] Добавить настройки для бота:
  - `BOT_AUTO_HANDLE` - автоматическое ведение диалога
  - `BOT_MAX_QUESTIONS` - максимальное количество вопросов

### Этап 8: Работа с сообщениями и мета тегами

**Файл:** `src/user-bot/chat3Client.js`

**Задачи:**
- [ ] Добавить метод `getDialogMessages(dialogId, limit, sort)` для получения истории сообщений
  - Использовать API: `GET /api/dialogs/:dialogId/messages?limit=10&sort={"createdAt":-1}`
  - Форматировать историю для контекста AI
- [ ] Добавить метод `getMessageMeta(messageId, key)` для получения мета тега сообщения
- [ ] Добавить метод `setMessageMeta(messageId, key, value)` для установки мета тега сообщения
- [ ] Добавить метод `getMessagesByMeta(dialogId, metaKey, metaValue)` для поиска сообщений по мета тегам
- [ ] Добавить метод `getBotConversationMessages(dialogId, conversationId)` для получения всех сообщений диалога уточнения:
  - Использовать фильтр: `(meta.botQuestion,eq,true)|(meta.botDialogResponse,eq,true)&(meta.botConversationId,eq,{conversationId})`
  - Или использовать несколько запросов с фильтрами и объединить результаты

## Структура файлов

```
src/user-bot/
├── index.js                    # Точка входа (уже есть)
├── config.js                   # Конфигурация (уже есть, расширить)
├── chat3Client.js              # Клиент Chat3 API (уже есть, расширить)
├── rabbitmq.js                 # RabbitMQ клиент (уже есть)
├── updateHandlers.js           # Обработчики updates (модифицировать)
├── dialogMetaManager.js        # НОВЫЙ: Управление мета тегами
├── aiClassifier.js             # НОВЫЙ: Классификатор AI
├── intentConfig.js             # НОВЫЙ: Конфигурация намерений
├── dialogStateManager.js       # НОВЫЙ: Управление состоянием
└── messageHandler.js           # НОВЫЙ: Основной обработчик
```

## Последовательность реализации

1. **Этап 1** - DialogMetaManager (базовая инфраструктура)
2. **Этап 2** - AIClassifier (интеграция с GigaChat)
3. **Этап 3** - IntentConfig (конфигурация намерений)
4. **Этап 4** - DialogStateManager (управление состоянием)
5. **Этап 5** - MessageHandler (основная логика)
6. **Этап 6** - Интеграция с updateHandlers
7. **Этап 7** - Конфигурация
8. **Этап 8** - Расширение chat3Client

## Примеры использования

### Пример 1: Первое сообщение в диалоге

```
Пользователь: "У меня не работает вход в систему"
→ Бот проверяет мета теги: категории нет
→ Бот вызывает AI для классификации
→ AI возвращает: { status: "success", intent: "support_technical", data: { issue_type: "авторизация" } }
→ Бот сохраняет категорию в мета теги
→ Бот отвечает: "Понял, проблема с авторизацией. Сейчас разберусь."
```

### Пример 2: Недостаточно данных

```
Пользователь: "Хочу вернуть деньги"
→ AI возвращает: { status: "insufficient_data", intent: "support_billing", data: { missing_required_fields: ["order_id", "reason"] } }
→ Бот задает вопрос: "Для возврата средств мне нужна информация. Укажите номер заказа и причину возврата."
→ Бот отправляет сообщение через sendMessage()
→ Бот помечает сообщение мета тегом: botQuestion=true, questionType="missing_field", relatedIntent="support_billing"
→ Бот устанавливает botHandling = true в мета тегах диалога
```

### Пример 3: Последующее сообщение с контекстом

```
Пользователь: "Заказ 12345, передумал"
→ Бот проверяет botHandling = true (диалог на обслуживании)
→ Бот получает botConversationId из мета тегов диалога
→ Бот помечает текущее сообщение пользователя мета тегом botDialogResponse и botConversationId
→ Бот получает все сообщения диалога уточнения одним запросом через getBotConversationMessages() с фильтром по botConversationId
  (включает вопросы бота с мета тегом botQuestion и ответы пользователя с мета тегом botDialogResponse, включая только что помеченное сообщение)
→ Бот формирует контекст для AI из всех сообщений диалога уточнения
→ Бот вызывает AI с контекстом
→ AI возвращает: { status: "success", intent: "support_billing", data: { order_id: "12345", reason: "передумал" } }
→ Бот обновляет категорию и lastIntent в мета тегах диалога
→ Бот обрабатывает запрос
→ Бот отвечает: "Оформляю возврат по заказу 12345"
→ Бот устанавливает botHandling = false (диалог уточнения завершен)
```

## Тестирование

1. **Unit тесты:**
   - DialogMetaManager - работа с мета тегами
   - AIClassifier - парсинг ответов AI
   - DialogStateManager - управление состоянием

2. **Интеграционные тесты:**
   - Полный цикл обработки сообщения
   - Определение категории через AI
   - Задание вопросов пользователю

3. **Ручное тестирование:**
   - Создать тестовый диалог
   - Отправить сообщения
   - Проверить работу AI классификации
   - Проверить сохранение мета тегов

## Дополнительные улучшения

1. **Кэширование** - кэшировать результаты классификации для похожих сообщений
2. **Логирование** - детальное логирование всех этапов обработки
3. **Метрики** - сбор метрик по классификации (точность, время ответа)
4. **Обработка ошибок** - graceful degradation при недоступности AI
5. **Мультиязычность** - поддержка разных языков для классификации

