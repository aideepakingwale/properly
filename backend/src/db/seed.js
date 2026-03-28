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
  // ── PHASE 2: Simple CVC Words (s a t p i n m d g o c k e u r h b f l) ──────
  { id:'p2_1', phase:2, title:'Cat and the Hat', emoji:'🐱', cover:'🐱🎩', acorns:15, sort_order:1,
    pages:[
      { idx:0, text:'The fat cat sat on the mat.', scene:'☀️🌿', bg:'bg-warm' },
      { idx:1, text:'The cat got up and ran to the red hat.', scene:'🏠🌸', bg:'bg-pink' },
      { idx:2, text:'The hat was big and the cat did not fit.', scene:'😅🎩', bg:'bg-orange' },
      { idx:3, text:'The cat sat on top of the hat and had a nap.', scene:'🌙💤', bg:'bg-purple' },
      { idx:4, text:'The cat woke up and the hat was flat!', scene:'😲🎩', bg:'bg-blue' },
    ]},
  { id:'p2_2', phase:2, title:'Big Dog Bud', emoji:'🐶', cover:'🐶🦴', acorns:15, sort_order:2,
    pages:[
      { idx:0, text:'Bud is a big tan dog with a wet nose.', scene:'🌳🌤️', bg:'bg-warm' },
      { idx:1, text:'Bud can dig and run and hop on the grass.', scene:'🌿🦋', bg:'bg-green' },
      { idx:2, text:'Bud got in the mud and it got on his leg.', scene:'💧🌧️', bg:'bg-blue' },
      { idx:3, text:'His pal Tom had to rub him with a rag.', scene:'🛁😄', bg:'bg-pink' },
      { idx:4, text:'Bud sat in the sun and had a big nap.', scene:'☀️😴', bg:'bg-orange' },
    ]},
  { id:'p2_3', phase:2, title:'Hen and Ten Eggs', emoji:'🐔', cover:'🐔🥚', acorns:15, sort_order:3,
    pages:[
      { idx:0, text:'The red hen sat in her pen on the farm.', scene:'🌅🌾', bg:'bg-orange' },
      { idx:1, text:'She had ten big fat eggs to sit on.', scene:'🌸🌻', bg:'bg-warm' },
      { idx:2, text:'She sat on them all day and all night.', scene:'🌙⭐', bg:'bg-purple' },
      { idx:3, text:'Tap tap tap! The eggs began to crack.', scene:'🥚💥', bg:'bg-pink' },
      { idx:4, text:'Ten little chicks ran out into the sun.', scene:'🐣🌈', bg:'bg-green' },
    ]},
  { id:'p2_4', phase:2, title:'The Pot of Mud', emoji:'🦊', cover:'🦊🪨', acorns:15, sort_order:4,
    pages:[
      { idx:0, text:'A red fox sat by a hot big pot.', scene:'🔥🌿', bg:'bg-orange' },
      { idx:1, text:'The fox put a bit of ham and a fig in it.', scene:'🍖🌲', bg:'bg-green' },
      { idx:2, text:'The fox hid the pot in the mud by the log.', scene:'🌳🦊', bg:'bg-warm' },
      { idx:3, text:'A dog ran up and sniffed at the log.', scene:'🐕👃', bg:'bg-blue' },
      { idx:4, text:'The dog dug up the pot and ran off fast!', scene:'💨🏃', bg:'bg-pink' },
    ]},

  // ── PHASE 3: Digraphs & Vowel Teams (ch sh th ai ee igh oa oo ar or) ──────────
  { id:'p3_1', phase:3, title:'Snail in the Rain', emoji:'🐌', cover:'🐌🌧️', acorns:20, sort_order:1,
    pages:[
      { idx:0, text:'A little snail set off in the rain.', scene:'🌧️🌿', bg:'bg-blue' },
      { idx:1, text:'She left a long shiny trail on the path.', scene:'✨🌱', bg:'bg-green' },
      { idx:2, text:'The rain was cool on her smooth brown shell.', scene:'💧🌀', bg:'bg-purple' },
      { idx:3, text:'She crept under a big green leaf to wait.', scene:'🍃☔', bg:'bg-warm' },
      { idx:4, text:'The sun came out and the snail went on her way.', scene:'☀️🌈', bg:'bg-orange' },
    ]},
  { id:'p3_2', phase:3, title:'Shark at the Beach', emoji:'🦈', cover:'🦈🌊', acorns:20, sort_order:2,
    pages:[
      { idx:0, text:'A shark swam out in the deep dark sea.', scene:'🌊🌙', bg:'bg-blue' },
      { idx:1, text:'She had sharp teeth and a bright silver fin.', scene:'🦈✨', bg:'bg-purple' },
      { idx:2, text:'She chased a shoal of fish near the reef.', scene:'🐟🪸', bg:'bg-green' },
      { idx:3, text:'The fish shot off into the dark cool water.', scene:'💨🌊', bg:'bg-dark', is_dark:1 },
      { idx:4, text:'The shark turned and swam back to the deep.', scene:'🌊⭐', bg:'bg-blue' },
    ]},
  { id:'p3_3', phase:3, title:'The Night Owl', emoji:'🦉', cover:'🦉🌙', acorns:20, sort_order:3,
    pages:[
      { idx:0, text:'The owl sat high in the old oak tree at night.', scene:'🌙🌲', bg:'bg-dark', is_dark:1 },
      { idx:1, text:'She had big round eyes that could see in the dark.', scene:'👁️⭐', bg:'bg-purple' },
      { idx:2, text:'She flew out to hunt for food in the moonlight.', scene:'🌕✨', bg:'bg-dark', is_dark:1 },
      { idx:3, text:'She caught a mouse near the tall green corn.', scene:'🌾🐭', bg:'bg-green' },
      { idx:4, text:'She flew back to her tree as the sun came up.', scene:'🌅🦉', bg:'bg-orange' },
    ]},

  // ── PHASE 4: CCVC & CVCC Blends (bl cl fl gr br str spl) ─────────────────────
  { id:'p4_1', phase:4, title:'The Best Nest', emoji:'🐦', cover:'🐦🪹', acorns:25, sort_order:1,
    pages:[
      { idx:0, text:'The bird flew from branch to branch to find the best spot.', scene:'🌸🍃', bg:'bg-orange' },
      { idx:1, text:'She found a strong branch and started to build her nest.', scene:'🪹🌿', bg:'bg-warm' },
      { idx:2, text:'She kept her three speckled eggs warm and snug.', scene:'☀️🥚', bg:'bg-green' },
      { idx:3, text:'At last she felt the shells crack and split.', scene:'💥🥚', bg:'bg-pink' },
      { idx:4, text:'Three small chicks crept out and filled the nest with chirps.', scene:'🐣🌈', bg:'bg-blue' },
      { idx:5, text:'She felt proud as she brought them their first grub.', scene:'🐛😊', bg:'bg-orange' },
    ]},
  { id:'p4_2', phase:4, title:'The Lost Frog', emoji:'🐸', cover:'🐸🏞️', acorns:25, sort_order:2,
    pages:[
      { idx:0, text:'The small green frog sat on the damp pond bank.', scene:'🌿🌧️', bg:'bg-green' },
      { idx:1, text:'He jumped and slipped and fell into the long thick grass.', scene:'🌾😟', bg:'bg-warm' },
      { idx:2, text:'He crept and stumbled and bumped into a flat grey stone.', scene:'🪨😮', bg:'bg-blue' },
      { idx:3, text:'He called out but his friends could not find him.', scene:'📢🌿', bg:'bg-orange' },
      { idx:4, text:'A kind blackbird saw him and led him back to the pond.', scene:'🐦🌊', bg:'bg-purple' },
      { idx:5, text:'The frog jumped in with a big splash and felt glad.', scene:'💦😄', bg:'bg-blue' },
    ]},

  // ── PHASE 5: Split Digraphs & Alternatives (a-e i-e ay ou ue) ─────────────────
  { id:'p5_1', phase:5, title:'Jake and the Kite', emoji:'🪁', cover:'🪁☁️', acorns:30, sort_order:1,
    pages:[
      { idx:0, text:'Jake made a kite out of red and white paper.', scene:'☀️🎨', bg:'bg-warm' },
      { idx:1, text:'He raced to the hill with the kite tucked under his arm.', scene:'🏃🌿', bg:'bg-green' },
      { idx:2, text:'The kite rose high and soared into the wide blue sky.', scene:'🌈☁️', bg:'bg-blue' },
      { idx:3, text:'A huge gust of wind made it swoop and twist and dive.', scene:'💨🌀', bg:'bg-purple' },
      { idx:4, text:'Jake gripped the string and held on with all his might.', scene:'💪😤', bg:'bg-orange' },
      { idx:5, text:'At dusk he rolled up the string and smiled at the fading sky.', scene:'🌅😊', bg:'bg-pink' },
    ]},
  { id:'p5_2', phase:5, title:'The Brave Knight', emoji:'⚔️', cover:'⚔️🏰', acorns:30, sort_order:2,
    pages:[
      { idx:0, text:'The brave knight rode alone through the dark pine forest.', scene:'🌲🌙', bg:'bg-dark', is_dark:1 },
      { idx:1, text:'He came to a huge stone gate at the old white castle.', scene:'🏰⭐', bg:'bg-purple' },
      { idx:2, text:'He spoke his name and the gate swung wide open.', scene:'🚪✨', bg:'bg-blue' },
      { idx:3, text:'Inside he saw a long bright hall with golden flames.', scene:'🔥🕯️', bg:'bg-orange' },
      { idx:4, text:'The knight bowed low and made his promise to the throne.', scene:'👑🙏', bg:'bg-warm' },
      { idx:5, text:'He rode home safe as the sun rose over the stone hills.', scene:'🌅🐴', bg:'bg-pink' },
    ]},
  { id:'p5_3', phase:5, title:'The Rose Garden', emoji:'🌹', cover:'🌹🌿', acorns:30, sort_order:3,
    pages:[
      { idx:0, text:'Mia planted a tiny rose seed in her garden in June.', scene:'🌱☀️', bg:'bg-warm' },
      { idx:1, text:'She gave it a shake of plant food and kept the soil damp.', scene:'💧🌿', bg:'bg-green' },
      { idx:2, text:'A pale green shoot poked up through the dark earth.', scene:'🌱🌞', bg:'bg-blue' },
      { idx:3, text:'Five bright red petals opened wide in the morning light.', scene:'🌺✨', bg:'bg-pink' },
      { idx:4, text:'Bees came to drink the sweet nectar from each bloom.', scene:'🐝🌸', bg:'bg-orange' },
      { idx:5, text:'Mia gave the rose to her gran and they smiled together.', scene:'👵🌹', bg:'bg-purple' },
    ]},

  // ── PHASE 6: Prefixes, Suffixes & Morphology ──────────────────────────────────
  { id:'p6_1', phase:6, title:'The Explorer', emoji:'🧭', cover:'🧭🗺️', acorns:40, sort_order:1,
    pages:[
      { idx:0, text:'The fearless explorer set off on an unexpected adventure.', scene:'🏔️🎒', bg:'bg-green' },
      { idx:1, text:'She carefully crossed an unfamiliar and completely rocky path.', scene:'🪨🌿', bg:'bg-warm' },
      { idx:2, text:'She discovered a breathtaking valley hidden between two mountains.', scene:'🏔️✨', bg:'bg-blue' },
      { idx:3, text:'She thoughtfully recorded every remarkable detail in her notebook.', scene:'📓✏️', bg:'bg-purple' },
      { idx:4, text:'She returned to share her wonderful and astonishing discovery.', scene:'🌍📢', bg:'bg-orange' },
      { idx:5, text:'Her endless excitement and determination made everyone feel proud.', scene:'🏆🎉', bg:'bg-pink' },
    ]},
  { id:'p6_2', phase:6, title:'The Invention', emoji:'🤖', cover:'🤖⚙️', acorns:40, sort_order:2,
    pages:[
      { idx:0, text:'The thoughtful scientist worked tirelessly in her remarkable laboratory.', scene:'⚗️🔬', bg:'bg-purple' },
      { idx:1, text:'She carefully collected countless scattered and unorganised pieces.', scene:'⚙️🔧', bg:'bg-warm' },
      { idx:2, text:'Her remarkable invention moved in completely unpredictable directions.', scene:'🤖✨', bg:'bg-blue' },
      { idx:3, text:'She fearlessly adjusted and reconfigured its extraordinary movements.', scene:'🔩💡', bg:'bg-orange' },
      { idx:4, text:'Her discovery brought unbelievable excitement to the worldwide community.', scene:'🌏📰', bg:'bg-green' },
      { idx:5, text:'Her thoughtfulness and determination made her a truly remarkable person.', scene:'🏆🌟', bg:'bg-pink' },
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
    INSERT INTO stories (id, phase, title, emoji, cover, acorns, page_count, sort_order)
    VALUES (@id, @phase, @title, @emoji, @cover, @acorns, @page_count, @sort_order)
    ON CONFLICT(id) DO UPDATE SET page_count=excluded.page_count, title=excluded.title, acorns=excluded.acorns
  `);
  // Delete existing pages for a story then re-insert — works with or without UNIQUE constraint
  const deleteStoryPages = db.prepare('DELETE FROM story_pages WHERE story_id = ?');
  const insertPage = db.prepare(`
    INSERT INTO story_pages (story_id, page_index, text, scene, bg_class, is_dark)
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
      deleteStoryPages.run(story.id);
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

export { seed as seedDatabase };
