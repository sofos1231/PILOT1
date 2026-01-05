# 🔄 LANE UPDATES REQUIRED
## Changes needed in Lanes 1-6 to integrate with Lane 7

---

## LANE 1 UPDATES

### 1. Run the additional SQL from Lane 7 Phase 1
The Lane 7 SQL adds these tables that weren't in the original schema:
- `matchmaking_queue`
- `chat_messages`
- `notifications`
- `match_moves`

### 2. Ensure routes index includes all routes
Your final `src/routes/index.ts` should import ALL route files.

---

## LANE 2 UPDATES

### 1. Add router import to Play tab
The Play tab needs the router for navigation:
```typescript
import { useRouter } from 'expo-router';
// Inside component:
const router = useRouter();
```

### 2. Ensure types directory has game.types.ts
Copy the game types from Lane 3 to `types/game.types.ts` in frontend.

---

## LANE 3 UPDATES

### 1. Export gameEngineService
Make sure `src/services/game-engine.service.ts` exports the singleton:
```typescript
export const gameEngineService = new GameEngineService();
```

### 2. Move applyMove to GameEngineService
The complete `applyMove` method must be in the game engine service (Lane 7 calls it).

---

## LANE 4 UPDATES

### 1. Add chat persistence import
At the top of `src/websocket/index.ts`:
```typescript
import { chatRepository } from '../repositories/chat.repository';
import { usersRepository } from '../repositories/users.repository';
```

### 2. Update club_chat_message handler
Replace the existing handler with the one from Lane 7 Phase 5.

### 3. Ensure wsUtils is exported
The websocket file must export `wsUtils` for other services to use.

---

## LANE 5 UPDATES

No changes required - Lane 5 is complete as-is.

---

## LANE 6 UPDATES

### 1. Add chat history endpoint
Add to `src/controllers/clubs.controller.ts`:
```typescript
async getChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { chatRepository } = require('../repositories/chat.repository');
    const messages = await chatRepository.getMessages(req.params.clubId, {
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });
    res.status(200).json({ success: true, messages });
  } catch (error) {
    next(error);
  }
}
```

### 2. Add chat route
Add to `src/routes/clubs.routes.ts`:
```typescript
router.get('/:clubId/chat', authMiddleware, clubsController.getChatHistory.bind(clubsController));
```

---

## EXECUTION ORDER (UPDATED)

```
1. Lane 1 → Backend foundation
2. Lane 2 → Frontend foundation  
3. Lane 3 → Game engine (backend + frontend types)
4. Lane 4 → WebSocket infrastructure
5. Lane 5 → Gold economy
6. Lane 6 → Club system
7. Lane 7 → Integration (ties everything together)
```

**Lane 7 should be executed LAST** as it depends on components from all other lanes.

---

## QUICK VERIFICATION CHECKLIST

Before starting Lane 7, verify:

- [ ] Backend starts without errors (`npm run dev`)
- [ ] Database has all tables from Lane 1 schema
- [ ] Can register a new user
- [ ] Can login and get tokens
- [ ] Frontend loads in Expo Go
- [ ] Can navigate all 5 tabs
- [ ] Auth persists after app restart

If all checks pass, proceed with Lane 7!
