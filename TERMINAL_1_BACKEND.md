# TERMINAL 1 - BACKEND TASKS ONLY
# Run this prompt in Cursor/Claude Code for backend work
# DO NOT modify any frontend files

---

Complete the backend tasks for club tables and gold shop. Work ONLY on backend files.

## TASK 1: Club Table Join Backend (3 files to modify)

### File 1: backgammon-backend/src/routes/clubs.routes.ts

Find the existing routes and add this new route after the cancel table route:

```typescript
router.post('/:clubId/tables/:tableId/join', authenticateToken, clubsController.joinTable);
```

### File 2: backgammon-backend/src/controllers/clubs.controller.ts

Add this new method to the clubs controller:

```typescript
async joinTable(req: Request, res: Response) {
  try {
    const { clubId, tableId } = req.params;
    const userId = req.user.id;
    
    const result = await clubsService.joinTable(clubId, tableId, userId);
    
    res.json({ 
      success: true, 
      message: 'Successfully joined table',
      table: result 
    });
  } catch (error: any) {
    console.error('Join table error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to join table'
    });
  }
}
```

Make sure to export this method if using a class, or add it to the exports object.

### File 3: backgammon-backend/src/services/clubs.service.ts

Add this new method to the clubs service:

```typescript
async joinTable(clubId: string, tableId: string, userId: string) {
  // 1. Verify user is a member of this club
  const membership = await clubMemberRepository.findOne({
    where: { clubId, userId }
  });
  
  if (!membership) {
    throw new Error('You must be a club member to join tables');
  }
  
  // 2. Get the table
  const table = await clubTableRepository.findOne({
    where: { id: tableId, clubId }
  });
  
  if (!table) {
    throw new Error('Table not found');
  }
  
  // 3. Validate table state
  if (table.status !== 'waiting') {
    throw new Error('This table is no longer available');
  }
  
  if (table.creatorId === userId) {
    throw new Error('You cannot join your own table');
  }
  
  if (table.opponentId) {
    throw new Error('This table is already full');
  }
  
  // 4. Check user has enough chips
  if (membership.chipBalance < table.betAmount) {
    throw new Error(`Insufficient chips. You need ${table.betAmount} chips to join this table.`);
  }
  
  // 5. Get creator's membership to deduct their chips
  const creatorMembership = await clubMemberRepository.findOne({
    where: { clubId, userId: table.creatorId }
  });
  
  if (!creatorMembership || creatorMembership.chipBalance < table.betAmount) {
    // Cancel the table if creator doesn't have enough chips anymore
    await clubTableRepository.update(tableId, { status: 'cancelled' });
    throw new Error('Table creator no longer has enough chips. Table has been cancelled.');
  }
  
  // 6. Deduct chips from both players
  await clubMemberRepository.update(
    { clubId, userId },
    { chipBalance: () => `chip_balance - ${table.betAmount}` }
  );
  
  await clubMemberRepository.update(
    { clubId, userId: table.creatorId },
    { chipBalance: () => `chip_balance - ${table.betAmount}` }
  );
  
  // 7. Update table with opponent and change status to playing
  await clubTableRepository.update(tableId, {
    opponentId: userId,
    status: 'playing',
    startedAt: new Date()
  });
  
  // 8. Return updated table
  const updatedTable = await clubTableRepository.findOne({
    where: { id: tableId },
    relations: ['creator', 'opponent']
  });
  
  return updatedTable;
}
```

Adjust the repository names and syntax based on your existing code patterns (TypeORM, Prisma, or raw SQL).

---

## TASK 2: Gold Demo Purchase Backend (2 files to modify)

### File 1: backgammon-backend/src/routes/gold.routes.ts

Add this new route:

```typescript
router.post('/demo-purchase', authenticateToken, goldController.demoPurchase);
```

### File 2: backgammon-backend/src/controllers/gold.controller.ts

Add this new method:

```typescript
async demoPurchase(req: Request, res: Response) {
  try {
    const { packageId } = req.body;
    const userId = req.user.id;
    
    if (!packageId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Package ID is required' 
      });
    }
    
    // 1. Get the package details
    const goldPackage = await goldService.getPackageById(packageId);
    
    if (!goldPackage) {
      return res.status(404).json({ 
        success: false, 
        message: 'Gold package not found' 
      });
    }
    
    // 2. Calculate total gold (base + bonus)
    const totalGold = goldPackage.goldAmount + (goldPackage.bonusAmount || 0);
    
    // 3. Add gold to user's balance
    await goldService.addGoldToUser(userId, totalGold);
    
    // 4. Create transaction record
    await goldService.createTransaction({
      userId,
      type: 'purchase',
      amount: totalGold,
      description: `Demo purchase: ${goldPackage.name}`,
      metadata: {
        packageId,
        packageName: goldPackage.name,
        baseAmount: goldPackage.goldAmount,
        bonusAmount: goldPackage.bonusAmount || 0,
        price: goldPackage.price,
        isDemoPurchase: true
      }
    });
    
    // 5. Get updated balance
    const newBalance = await goldService.getUserBalance(userId);
    
    res.json({
      success: true,
      message: `Successfully purchased ${totalGold.toLocaleString()} gold!`,
      goldAdded: totalGold,
      newBalance
    });
    
  } catch (error: any) {
    console.error('Demo purchase error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Purchase failed' 
    });
  }
}
```

---

## VERIFICATION AFTER COMPLETION

Run these checks:

1. Backend compiles without errors:
```bash
cd backgammon-backend
npm run build
```

2. Start the server:
```bash
npm run dev
```

3. Test endpoints exist (should not return 404):
- POST /api/clubs/:clubId/tables/:tableId/join
- POST /api/gold/demo-purchase

---

## FILES MODIFIED SUMMARY

| File | Changes |
|------|---------|
| routes/clubs.routes.ts | Added join table route |
| controllers/clubs.controller.ts | Added joinTable method |
| services/clubs.service.ts | Added joinTable logic |
| routes/gold.routes.ts | Added demo-purchase route |
| controllers/gold.controller.ts | Added demoPurchase method |

---

## ⚠️ IMPORTANT

- Do NOT touch any files in backgammon-mobile/
- Adapt the code to match your existing patterns (repository names, etc.)
- Make sure all imports are added at the top of files
- Test that the backend starts without errors before moving on
