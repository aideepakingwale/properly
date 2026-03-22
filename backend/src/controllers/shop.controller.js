import getDb from '../db/database.js';

export const getShopItems = (req, res) => {
  const db = getDb();
  const { category } = req.query;
  const items = category
    ? db.prepare('SELECT * FROM shop_items WHERE category = ? ORDER BY sort_order').all(category)
    : db.prepare('SELECT * FROM shop_items ORDER BY category, sort_order').all();
  res.json({ success: true, data: items });
};

export const getOwnedItems = (req, res) => {
  const db = getDb();
  const owned = db.prepare('SELECT item_id FROM owned_items WHERE child_id = ?').all(req.child.id);
  res.json({ success: true, data: owned.map(r => r.item_id) });
};

export const purchaseItem = (req, res) => {
  const { itemId } = req.body;
  const db = getDb();

  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  const alreadyOwned = db.prepare('SELECT id FROM owned_items WHERE child_id = ? AND item_id = ?').get(req.child.id, itemId);
  if (alreadyOwned) return res.status(409).json({ success: false, message: 'Already owned' });

  if (req.child.acorns < item.cost) {
    return res.status(400).json({
      success: false,
      message: `Not enough acorns. Need ${item.cost}, have ${req.child.acorns}.`
    });
  }

  const doPurchase = db.transaction(() => {
    db.prepare('UPDATE children SET acorns = acorns - ? WHERE id = ?').run(item.cost, req.child.id);
    db.prepare('INSERT INTO owned_items (child_id, item_id) VALUES (?,?)').run(req.child.id, itemId);
    return db.prepare('SELECT acorns FROM children WHERE id = ?').get(req.child.id);
  });

  const updated = doPurchase();
  res.json({ success: true, data: { remainingAcorns: updated.acorns, itemName: item.name } });
};
