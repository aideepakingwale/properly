/**
 * @file        seed.js
 * @description Seed data — curriculum stories (Phase 2-6), shop items, and achievements
 * @module      Database
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Uses INSERT OR IGNORE so re-running seed is safe (idempotent)
 *   - Called explicitly by app.js after initDatabase() — not at module import time
 */

import getDb from './database.js';

const STORIES = [
  // Phase 2
  { id:'p2_1', phase:2, title:'Cat and the Hat', emoji:'🐱', cover:'🐱🎩', acorns:15, sort_order:1,
    pages:[
      { idx:0, text:'The fat cat sat on the mat.', scene:'☀️🌿', bg:'bg-warm' },
      { idx:1, text:'The cat ran to get a big red hat.', scene:'🏠🌸', bg:'bg-pink' },
      { idx:2, text:'The cat sat and had a nap in its hat.', scene:'🌙⭐', bg:'bg-purple' },
    ]},
  { id:'p2_2', phase:2, title:'Big Dog Bud', emoji:'🐶', cover:'🐶🦴', acorns:15, sort_order:2,
    pages:[
      { idx:0, text:'Bud is a big tan dog.', scene:'🌳🌤️', bg:'bg-warm' },
      { idx:1, text:'Bud can dig and run and hop.', scene:'🌿🦋', bg:'bg-green' },
      { idx:2, text:'Bud sat in the mud and got wet.', scene:'💧🌧️', bg:'bg-blue' },
    ]},
  { id:'p2_3', phase:2, title:'Hen and Ten Eggs', emoji:'🐔', cover:'🐔🥚', acorns:15, sort_order:3,
    pages:[
      { idx:0, text:'The red hen sat in her pen.', scene:'🌅🌾', bg:'bg-orange' },
      { idx:1, text:'She had ten big fat eggs to sit on.', scene:'🌸🌻', bg:'bg-warm' },
      { idx:2, text:'The hen got up and a chick ran out.', scene:'🐣🌈', bg:'bg-green' },
    ]},
  { id:'p2_4', phase:2, title:'The Pot of Mud', emoji:'🦊', cover:'🦊🪨', acorns:15, sort_order:4,
    pages:[
      { idx:0, text:'A fox sat by a hot pot.', scene:'🔥🌿', bg:'bg-orange' },
      { idx:1, text:'The fox hid a bit of ham in it.', scene:'🌲🦊', bg:'bg-green' },
      { idx:2, text:'The dog dug it up and ran off fast.', scene:'💨🌳', bg:'bg-blue' },
    ]},
  // Phase 3
  { id:'p3_1', phase:3, title:'Snail in the Rain', emoji:'🐌', cover:'🐌🌧️', acorns:20, sort_order:1,
    pages:[
      { idx:0, text:'The snail went out in the rain.', scene:'🌧️🌿', bg:'bg-blue' },
      { idx:1, text:'She left a long silver trail on the path.', scene:'✨🌱', bg:'bg-green' },
      { idx:2, text:'The snail found a big green leaf to eat.', scene:'🍃🌤️', bg:'bg-warm' },
    ]},
  { id:'p3_2', phase:3, title:'Beach Day', emoji:'⛱️', cover:'⛱️🐚', acorns:20, sort_order:2,
    pages:[
      { idx:0, text:'We went to the beach on a hot day.', scene:'☀️🌊', bg:'bg-warm' },
      { idx:1, text:'I could see tall ships far out at sea.', scene:'⛵🐟', bg:'bg-blue' },
      { idx:2, text:'We each found a pink shell on the wet sand.', scene:'🐚🌅', bg:'bg-pink' },
    ]},
  { id:'p3_3', phase:3, title:'Flash the Fish', emoji:'🐠', cover:'🐠🌊', acorns:20, sort_order:3,
    pages:[
      { idx:0, text:'Flash is a bright fish with a long tail.', scene:'🌊🌿', bg:'bg-blue' },
      { idx:1, text:'She swam deep in the cool dark pool.', scene:'🐙🪸', bg:'bg-purple' },
      { idx:2, text:'She found a shell and made it her home.', scene:'🐚✨', bg:'bg-green' },
    ]},
  // Phase 4
  { id:'p4_1', phase:4, title:'The Best Nest', emoji:'🐦', cover:'🐦🪹', acorns:25, sort_order:1,
    pages:[
      { idx:0, text:'The bird built the best nest she could find.', scene:'🌸🍃', bg:'bg-orange' },
      { idx:1, text:'She kept her three cracked eggs warm and snug.', scene:'☀️🌿', bg:'bg-warm' },
      { idx:2, text:'The small chicks crept out of their broken shells.', scene:'🌈🌸', bg:'bg-green' },
    ]},
  { id:'p4_2', phase:4, title:'Lost Frog', emoji:'🐸', cover:'🐸🏞️', acorns:25, sort_order:2,
    pages:[
      { idx:0, text:'The frog jumped from the steep pond bank.', scene:'🌿🌧️', bg:'bg-blue' },
      { idx:1, text:'It went on a long damp trip through the thick grass.', scene:'🌾🦗', bg:'bg-green' },
      { idx:2, text:'At last the frog crept back to its pond.', scene:'🌅🌊', bg:'bg-warm' },
    ]},
  // Phase 5
  { id:'p5_1', phase:5, title:'Jake and the Kite', emoji:'🪁', cover:'🪁☁️', acorns:30, sort_order:1,
    pages:[
      { idx:0, text:'Jake made a kite on a fine summer day.', scene:'☀️🌤️', bg:'bg-warm' },
      { idx:1, text:'The kite rose high into the wide blue sky.', scene:'🌈☁️', bg:'bg-blue' },
      { idx:2, text:'A huge gust of wind made the kite swoop and dive.', scene:'💨🌿', bg:'bg-green' },
    ]},
  { id:'p5_2', phase:5, title:'The Brave Knight', emoji:'⚔️', cover:'⚔️🏰', acorns:30, sort_order:2,
    pages:[
      { idx:0, text:'The brave knight rode home through the dark night.', scene:'🌙⭐', bg:'bg-purple' },
      { idx:1, text:'He came to a huge stone gate at the old castle.', scene:'🏰🌲', bg:'bg-dark', is_dark:1 },
      { idx:2, text:'The knight smiled as he rode in from the cold.', scene:'🔥🏠', bg:'bg-orange' },
    ]},
  { id:'p5_3', phase:5, title:'The Rose Garden', emoji:'🌹', cover:'🌹🌿', acorns:30, sort_order:3,
    pages:[
      { idx:0, text:'Mia grew a rose in her small stone lane.', scene:'🌸☀️', bg:'bg-pink' },
      { idx:1, text:'The rose had five bright petals on each stem.', scene:'🌺🦋', bg:'bg-warm' },
      { idx:2, text:'She gave the rose to her gran on her birthday.', scene:'🎂🌹', bg:'bg-green' },
    ]},
  // Phase 6
  { id:'p6_1', phase:6, title:'The Explorer', emoji:'🧭', cover:'🧭🗺️', acorns:40, sort_order:1,
    pages:[
      { idx:0, text:'The fearless explorer discovered a completely hidden green valley.', scene:'🏔️🌿', bg:'bg-green' },
      { idx:1, text:'She carefully mapped the entirely unfamiliar rocky landscape.', scene:'🗺️✏️', bg:'bg-warm' },
      { idx:2, text:'Her remarkable discovery brought worldwide excitement and endless celebration.', scene:'🌍🎉', bg:'bg-blue' },
    ]},
  { id:'p6_2', phase:6, title:'Robot Helpers', emoji:'🤖', cover:'🤖⚙️', acorns:40, sort_order:2,
    pages:[
      { idx:0, text:'The unbelievable robot carefully collected the scattered pieces.', scene:'⚙️🔧', bg:'bg-purple' },
      { idx:1, text:'Its remarkable movements were completely unpredictable to the watchers.', scene:'👀✨', bg:'bg-warm' },
      { idx:2, text:'The thoughtful invention became the greatest discovery of the century.', scene:'🏆🌟', bg:'bg-orange' },
    ]},
];

const SHOP_ITEMS = [
  { id:'hat_wizard', name:'Wizard Hat',       emoji:'🧙', cost:50,  category:'digital',   description:'Magical power for Pippin!', sort_order:1 },
  { id:'hat_crown',  name:'Royal Crown',      emoji:'👑', cost:80,  category:'digital',   description:'Rule the Phonics Forest!',  sort_order:2 },
  { id:'cape_star',  name:'Star Cape',        emoji:'🌟', cost:65,  category:'digital',   description:'Shine brighter than ever!', sort_order:3 },
  { id:'glasses',    name:'Cool Shades',      emoji:'😎', cost:40,  category:'digital',   description:'Too cool for school!',      sort_order:4 },
  { id:'bow',        name:'Rainbow Bow',      emoji:'🎀', cost:45,  category:'digital',   description:'Pretty and proud!',         sort_order:5 },
  { id:'pet_dragon', name:'Pet Dragon',       emoji:'🐉', cost:120, category:'digital',   description:'Your very own dragon!',     sort_order:6 },
  { id:'pet_uni',    name:'Unicorn Pal',      emoji:'🦄', cost:140, category:'digital',   description:'A magical friend!',         sort_order:7 },
  { id:'bg_space',   name:'Outer Space',      emoji:'🚀', cost:90,  category:'digital',   description:'Explore the stars!',        sort_order:8 },
  { id:'bg_castle',  name:'Magic Castle',     emoji:'🏰', cost:100, category:'digital',   description:'Rule your realm!',          sort_order:9 },
  { id:'cert',       name:'Reader Certificate',emoji:'📜', cost:150, category:'print',    description:'Official proof of brilliance!', sort_order:1 },
  { id:'bookmark',   name:'Personalised Bookmark', emoji:'🔖', cost:80, category:'print', description:'Never lose your place!',    sort_order:2 },
  { id:'colorbook',  name:'Pippin Colouring Book', emoji:'🎨', cost:250, category:'print',description:'8 pages of colouring fun!', sort_order:3 },
  { id:'stickers',   name:'Pippin Sticker Sheet',  emoji:'🌈', cost:500, category:'physical', description:'Real stickers posted to you!', sort_order:1 },
  { id:'pin',        name:'Enamel Reading Pin',     emoji:'📌', cost:800, category:'physical', description:'Wear your achievement!',  sort_order:2 },
];

const ACHIEVEMENTS = [
  { id:'first_story',   title:'First Steps',         emoji:'👣', description:'Complete your first story',       xp:50,  condition_type:'stories_done',   condition_value:1 },
  { id:'five_stories',  title:'Bookworm',             emoji:'📚', description:'Complete 5 stories',             xp:100, condition_type:'stories_done',   condition_value:5 },
  { id:'ten_stories',   title:'Story Master',         emoji:'🎓', description:'Complete 10 stories',            xp:200, condition_type:'stories_done',   condition_value:10 },
  { id:'phase3_reach',  title:'Digraph Detective',    emoji:'🔍', description:'Reach Phase 3',                  xp:75,  condition_type:'phase',          condition_value:3 },
  { id:'phase4_reach',  title:'Blend Champion',       emoji:'🏅', description:'Reach Phase 4',                  xp:100, condition_type:'phase',          condition_value:4 },
  { id:'phase5_reach',  title:'Split Digraph Hero',   emoji:'⚡', description:'Reach Phase 5',                  xp:125, condition_type:'phase',          condition_value:5 },
  { id:'phase6_reach',  title:'Phonics Legend',       emoji:'👑', description:'Reach Phase 6',                  xp:200, condition_type:'phase',          condition_value:6 },
  { id:'streak3',       title:'3-Day Streak',         emoji:'🔥', description:'Read 3 days in a row',           xp:60,  condition_type:'streak',         condition_value:3 },
  { id:'streak7',       title:'Week Warrior',         emoji:'⚡', description:'Read 7 days in a row',           xp:150, condition_type:'streak',         condition_value:7 },
  { id:'acorns100',     title:'Acorn Collector',      emoji:'🌰', description:'Earn 100 Golden Acorns',         xp:50,  condition_type:'total_acorns',   condition_value:100 },
  { id:'acorns500',     title:'Acorn Hoarder',        emoji:'🏦', description:'Earn 500 Golden Acorns',         xp:100, condition_type:'total_acorns',   condition_value:500 },
  { id:'words100',      title:'Word Wizard',          emoji:'✨', description:'Read 100 words total',           xp:75,  condition_type:'words_read',     condition_value:100 },
  { id:'words500',      title:'Story Sage',           emoji:'🦉', description:'Read 500 words total',           xp:150, condition_type:'words_read',     condition_value:500 },
  { id:'perfect_page',  title:'Perfectionist',        emoji:'💎', description:'Score 100% accuracy on a page',  xp:100, condition_type:'has_perfect',    condition_value:1 },
];

export function seed() {
  const db = getDb();

  const insertStory = db.prepare(`
    INSERT OR IGNORE INTO stories (id, phase, title, emoji, cover, acorns, page_count, sort_order)
    VALUES (@id, @phase, @title, @emoji, @cover, @acorns, @page_count, @sort_order)
  `);
  const insertPage = db.prepare(`
    INSERT OR IGNORE INTO story_pages (story_id, page_index, text, scene, bg_class, is_dark)
    VALUES (@story_id, @page_index, @text, @scene, @bg_class, @is_dark)
  `);
  const insertShop = db.prepare(`
    INSERT OR IGNORE INTO shop_items (id, name, emoji, cost, category, description, sort_order)
    VALUES (@id, @name, @emoji, @cost, @category, @description, @sort_order)
  `);
  const insertAchievement = db.prepare(`
    INSERT OR IGNORE INTO achievements (id, title, emoji, description, xp, condition_type, condition_value)
    VALUES (@id, @title, @emoji, @description, @xp, @condition_type, @condition_value)
  `);

  const seedAll = db.transaction(() => {
    for (const story of STORIES) {
      insertStory.run({
        id:         story.id,
        phase:      story.phase,
        title:      story.title,
        emoji:      story.emoji,
        cover:      story.cover,
        acorns:     story.acorns,
        page_count: story.pages.length,
        sort_order: story.sort_order,
      });
      for (const page of story.pages) {
        insertPage.run({
          story_id: story.id,
          page_index: page.idx,
          text: page.text,
          scene: page.scene,
          bg_class: page.bg,
          is_dark: page.is_dark || 0,
        });
      }
    }
    for (const item of SHOP_ITEMS) insertShop.run(item);
    for (const ach of ACHIEVEMENTS) insertAchievement.run(ach);
  });

  seedAll();
  console.log(`✅ Seeded ${STORIES.length} stories, ${SHOP_ITEMS.length} shop items, ${ACHIEVEMENTS.length} achievements`);
}

