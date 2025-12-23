# Система событий Chat3

## Обзор

Chat3 использует событийно-ориентированную архитектуру. Все изменения в системе генерируют события, которые сохраняются в MongoDB и публикуются в RabbitMQ.

## Модель Event

```javascript
{
  _id: ObjectId("..."),      // MongoDB ObjectId
  eventId: "evt_...",        // Уникальный ID события (evt_ + 32 hex символа)
  tenantId: "tnt_default",   // ID тенанта
  eventType: "dialog.create", // Тип события
  entityType: "dialog",      // Тип сущности
  entityId: "dlg_...",       // ID сущности
  actorId: "carl",           // ID пользователя, инициировавшего событие (опционально)
  actorType: "api",          // Тип актора (user, system, bot, api)
  data: { ... },             // Данные события (context, dialog, message, member, typing, user, actor)
  createdAt: 1763551369397.6482  // Timestamp создания (микросекунды)
}
```

**Поддерживаемые типы событий:**
- `dialog.create`, `dialog.update`, `dialog.delete`
- `message.create`, `message.update`
- `dialog.member.add`, `dialog.member.remove`, `dialog.member.update`
- `message.status.update`
- `message.reaction.update`
- `dialog.typing`
- `user.add`, `user.update`, `user.remove`

## Соответствие событий и обновлений

| Событие (Event) | Entity Type | Routing Key (Events) | Создаваемый Update | Routing Key (Updates) | Получатели | Дополнительные Updates |
|-----------------|-------------|---------------------|-------------------|---------------------|-----------|----------------------|
| `dialog.create` | `dialog` | `dialog.create.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | - |
| `dialog.update` | `dialog` | `dialog.update.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | - |
| `dialog.delete` | `dialog` | `dialog.delete.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | - |
| `dialog.member.add` | `dialogMember` | `dialogMember.add.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | `UserStatsUpdate` для добавленного пользователя (`dialogCount`) |
| `dialog.member.remove` | `dialogMember` | `dialogMember.remove.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники + удаляемый пользователь | `UserStatsUpdate` для удаленного пользователя (`dialogCount`) |
| `dialog.member.update` | `dialogMember` | `dialogMember.update.{tenantId}` | `DialogMemberUpdate` | `update.dialog.{userType}.{userId}.dialogmemberupdate` | Конкретный участник | `UserStatsUpdate` (если изменился `unreadCount`) |
| `message.create` | `message` | `message.create.{tenantId}` | `MessageUpdate` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | `UserStatsUpdate` для участников (если диалог стал непрочитанным) |
| `message.update` | `message` | `message.update.{tenantId}` | `MessageUpdate` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | - |
| `message.status.update` | `messageStatus` | `messageStatus.update.{tenantId}` | `MessageUpdate` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | - |
| `message.reaction.update` | `messageReaction` | `messageReaction.update.{tenantId}` | `MessageUpdate` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | - |
| `dialog.typing` | `dialog` | `dialog.typing.{tenantId}` | `TypingUpdate` | `update.dialog.{userType}.{userId}.typingupdate` | Все участники (кроме инициатора) | - |
| `user.add` | `user` | `user.add.{tenantId}` | `UserUpdate` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | - |
| `user.update` | `user` | `user.update.{tenantId}` | `UserUpdate` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | - |
| `user.remove` | `user` | `user.remove.{tenantId}` | `UserUpdate` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | - |

**Примечания:**
- `{userType}` - тип пользователя из модели User (user, bot, contact и т.д.)
- `{userId}` - ID пользователя-получателя update
- `{tenantId}` - ID тенанта (например, tnt_default)
- Routing keys для Updates имеют формат: `update.{category}.{userType}.{userId}.{updateType}`
- Routing keys для Events имеют формат: `{entityType}.{action}.{tenantId}`
- `UserStatsUpdate` создается автоматически при изменении статистики пользователя (не является прямым результатом события)

## Типы событий

### Dialog Events

#### dialog.create
Создание диалога

**Routing Key:** `dialog.create.{tenantId}` (например, `dialog.create.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "dialog.create",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "actor"]
  },
  "dialog": {
    "dialogId": "dlg_...",
    "tenantId": "tnt_default",
    "name": "VIP чат",
    "createdBy": "carl",
    "createdAt": 1763551369397.6482,
    "updatedAt": 1763551369397.6482,
    "meta": {}
  },
  "actor": {
    "actorId": "api-key-name",
    "actorType": "api"
  }
}
```

#### dialog.update
Обновление диалога

**Routing Key:** `dialog.update.{tenantId}`

#### dialog.delete
Удаление диалога

**Routing Key:** `dialog.delete.{tenantId}`

### Dialog Member Events

#### dialog.member.add
Добавление участника в диалог

**Routing Key:** `dialogMember.add.{tenantId}` (например, `dialogMember.add.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "dialog.member.add",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "member", "actor"]
  },
  "dialog": { ... },
  "member": {
    "userId": "carl",
    "meta": {},
    "state": {
      "unreadCount": 0,
      "lastSeenAt": 1763551369397.6482,
      "lastMessageAt": null,
      "isActive": true
    }
  },
  "actor": { ... }
}
```

#### dialog.member.remove
Удаление участника из диалога

**Routing Key:** `dialogMember.remove.{tenantId}`

#### dialog.member.update
Обновление участника диалога

**Routing Key:** `dialogMember.update.{tenantId}`

### Message Events

#### message.create
Создание сообщения

**Routing Key:** `message.create.{tenantId}` (например, `message.create.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "message.create",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message", "actor"]
  },
  "dialog": { ... },
  "message": {
    "messageId": "msg_...",
    "dialogId": "dlg_...",
    "senderId": "carl",
    "type": "internal.text",
    "content": "Hello!",
    "meta": {},
    "statuses": [],
    "reactionCounts": {}
  },
  "actor": { ... }
}
```

#### message.update
Обновление сообщения

**Routing Key:** `message.update.{tenantId}`

**Примечание:** Создается при обновлении содержимого сообщения через `PUT /api/messages/:messageId`

### Message Status Events

#### message.status.update
Обновление статуса сообщения

**Routing Key:** `messageStatus.update.{tenantId}` (например, `messageStatus.update.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "message.status.update",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message", "statusUpdate", "actor"]
  },
  "dialog": { ... },
  "message": { ... },
  "statusUpdate": {
    "userId": "carl",
    "status": "read",
    "readAt": 1763551369397.6482,
    "createdAt": 1763551369397.6482
  },
  "actor": { ... }
}
```

**Примечание:** Создается при изменении статуса сообщения через `POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/status/:status`

### Message Reaction Events

#### message.reaction.update
Обновление реакции на сообщение

**Routing Key:** `messageReaction.update.{tenantId}` (например, `messageReaction.update.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "message.reaction.update",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message", "reactionUpdate", "actor"]
  },
  "dialog": { ... },
  "message": { ... },
  "reactionUpdate": {
    "userId": "carl",
    "reaction": "👍",
    "createdAt": 1763551369397.6482
  },
  "actor": { ... }
}
```

**Примечание:** Создается при добавлении или удалении реакции через `POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/reactions/:action` (action: `set` или `unset`)

### Typing Events

#### dialog.typing
Индикатор печати

**Routing Key:** `dialog.typing.{tenantId}` (например, `dialog.typing.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "dialog.typing",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "typing", "actor"]
  },
  "dialog": { ... },
  "typing": {
    "userId": "carl",
    "expiresInMs": 5000,
    "timestamp": 1763551369397.6482,
    "userInfo": null
  },
  "actor": { ... }
}
```

**Примечание:** Typing события не создают Updates, они публикуются напрямую в RabbitMQ

### User Events

#### user.add
Создание пользователя

**Routing Key:** `user.add.{tenantId}` (например, `user.add.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "user.add",
    "entityId": "carl",
    "includedSections": ["user", "actor"]
  },
  "user": {
    "userId": "carl",
    "type": "user",
    "meta": {}
  },
  "actor": { ... }
}
```

#### user.update
Обновление пользователя

**Routing Key:** `user.update.{tenantId}`

**Data:**
```json
{
  "context": {
    "eventType": "user.update",
    "entityId": "carl",
    "includedSections": ["user", "actor"],
    "updatedFields": ["name", "type"]
  },
  "user": {
    "userId": "carl",
    "type": "bot",
    "meta": {}
  },
  "actor": { ... }
}
```

#### user.remove
Удаление пользователя

**Routing Key:** `user.remove.{tenantId}`

### Tenant Events

#### tenant.create
Создание тенанта

**Routing Key:** `tenant.create.{tenantId}`

#### tenant.update
Обновление тенанта

**Routing Key:** `tenant.update.{tenantId}`

#### tenant.delete
Удаление тенанта

**Routing Key:** `tenant.delete.{tenantId}`

## RabbitMQ Exchange

### Exchange: chat3_events

- **Тип:** topic
- **Durable:** true

### Routing Keys

Формат: `{entityType}.{action}.{tenantId}`

Где:
- `entityType` - тип сущности (dialog, message, dialogMember, messageStatus, messageReaction, user, tenant)
- `action` - действие (последняя часть eventType: create, update, delete, add, remove, typing)
- `tenantId` - ID тенанта (например, tnt_default)

**Примеры:**
- `dialog.create.tnt_default` - создание диалога
- `message.create.tnt_default` - создание сообщения
- `dialogMember.add.tnt_default` - добавление участника
- `messageStatus.update.tnt_default` - обновление статуса сообщения
- `messageReaction.update.tnt_default` - обновление реакции
- `dialog.typing.tnt_default` - индикатор печати
- `user.add.tnt_default` - создание пользователя

### Подписка на события

```javascript
// Подписка на все события диалогов для конкретного тенанта
channel.bindQueue(queueName, 'chat3_events', 'dialog.*.tnt_default');

// Подписка на все события создания диалогов для всех тенантов
channel.bindQueue(queueName, 'chat3_events', 'dialog.create.*');

// Подписка на все события сообщений для конкретного тенанта
channel.bindQueue(queueName, 'chat3_events', 'message.*.tnt_default');

// Подписка на конкретное событие для конкретного тенанта
channel.bindQueue(queueName, 'chat3_events', 'dialog.create.tnt_default');

// Подписка на все события для конкретного тенанта
channel.bindQueue(queueName, 'chat3_events', '*.*.tnt_default');

// Подписка на все события всех тенантов
channel.bindQueue(queueName, 'chat3_events', '#');
```

## Структура данных события

### Context Section

```json
{
  "version": 2,
  "eventType": "dialog.create",
  "dialogId": "dlg_...",
  "entityId": "dlg_...",
  "messageId": null,
  "includedSections": ["dialog", "actor"],
  "updatedFields": []
}
```

### Dialog Section

```json
{
  "dialogId": "dlg_...",
  "tenantId": "tnt_default",
  "name": "VIP чат",
  "createdBy": "carl",
  "createdAt": 1763551369397.6482,
  "updatedAt": 1763551369397.6482,
  "meta": {}
}
```

### Member Section

```json
{
  "userId": "carl",
  "meta": {},
  "state": {
    "unreadCount": 0,
    "lastSeenAt": 1763551369397.6482,
    "lastMessageAt": null,
    "isActive": true
  }
}
```

### Message Section

```json
{
  "messageId": "msg_...",
  "dialogId": "dlg_...",
  "senderId": "carl",
  "type": "internal.text",
  "content": "Hello!",
  "meta": {},
  "statuses": [],
  "reactionCounts": {},
  "senderInfo": {
    "userId": "carl",
    "name": "Carl Johnson",
    "lastActiveAt": 1763551369397.6482,
    "meta": {}
  }
}
```

### Actor Section

```json
{
  "actorId": "api-key-name",
  "actorType": "api"
}
```

## Обработка событий

События обрабатываются Update Worker:

1. Событие публикуется в RabbitMQ exchange `chat3_events`
2. Update Worker получает событие из очереди `update_worker_queue`
3. Worker определяет, нужно ли создавать Update
4. Если нужно, создаются Update записи для всех затронутых пользователей
5. Updates публикуются в RabbitMQ exchange `chat3_updates`

## Версионирование

События используют версию payload: `version: 2`

При изменении структуры данных события версия должна быть увеличена.

