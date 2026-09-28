import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PEOPLE} from '../src/content.js';
import {OBSERVATIONS} from '../src/demo.js';

// The only save writes are isolated test checkpoints in fresh browser contexts.
// Renderer harnesses use the real modules without production debug globals.
const base = process.env.GUEST_PROPS_BASE_URL || 'http://127.0.0.1:4173';
const out = 'verification/guest-props-v1';
const keys = ['handbag', 'toolbox', 'camera', 'medicine-case', 'duffel', 'briefcase', 'wrench'];
const layouts = {lin: ['handbag'], zhou: ['toolbox', 'wrench'], xu: ['camera'], tang: ['medicine-case'], luo: ['duffel'], chen: ['briefcase'], gu: ['camera']};
const guests = PEOPLE.flat(), ids = guests.map(g => g.id);
const fixturePath = 'verification/fixed-rooms/night-fixture.json';
const fixtureBytes = await readFile(fixturePath), fixture = JSON.parse(fixtureBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, {recursive: true});
for (const id of ids) await mkdir(`${out}/${id}`, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const errors = [], expectedResourceErrors = [], assets = [], screenshots = [], states = {};
const watch = (page, missing = false) => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const url = message.location().url, text = message.text();
    if (url.endsWith('/favicon.ico') && text.includes('404') || missing && url.includes('/assets/props/') && text.includes('ERR_FAILED')) expectedResourceErrors.push(`${url}: ${text}`);
    else errors.push(`${url}: ${text}`);
  });
};
const shot = async (page, name) => {
  await page.waitForTimeout(120);
  await page.screenshot({path: `${out}/${name}.png`}); screenshots.push(`${name}.png`);
};
const click = (page, action) => page.locator(`[data-act="${action}"]`).click();
const world = page => page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map(entry => entry.name).find(url => new URL(url).pathname === '/src/world.js');
  if (!url) throw Error('Application renderer missing');
  return (await import(url)).getCharacterState();
});
const previewState = async page => JSON.parse(await page.locator('#preview-state').textContent());
async function waitState(read, predicate, label) {
  let value;
  for (let attempt = 0; attempt < 150; attempt++) {
    value = await read(); if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(predicate(value), `${label}: ${JSON.stringify(value)}`);
}
function checkProps(props, id, kind = 'model') {
  assert.deepEqual(props.map(prop => prop.key).sort(), [...layouts[id]].sort(), `${id}: exact belongings`);
  for (const prop of props) {
    assert.equal(prop.guestId, id); assert.equal(prop.kind, kind);
    assert.equal(prop.source, `/assets/props/${prop.key}-v1.glb`);
    assert.equal(prop.fallback, kind === 'fallback', `${prop.id}: no old block alongside loaded model`);
    assert.equal(prop.visible, kind !== 'loading');
    if (kind === 'loading') {assert.equal(prop.bounds, null); continue;}
    const {min, max, size} = prop.bounds;
    assert.ok([...min, ...max, ...size].every(Number.isFinite), `${prop.id}: finite dimensions`);
    assert.ok(size.every(value => value > 0 && value < 1.4), `${prop.id}: tabletop scale`);
    assert.ok(min[1] >= prop.tableY - .015, `${prop.id}: does not penetrate table`);
    assert.ok(min[1] <= prop.tableY + .05, `${prop.id}: does not float above table`);
  }
}
const waitProps = (page, id, mode = 'reception') => waitState(() => world(page), state => state.mode === mode && state.props.length === layouts[id].length && state.props.every(prop => prop.guestId === id && prop.kind === 'model'), `${id}/${mode} props`);
function parseGlb(bytes, key) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', key);
  assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
  const chunks = []; let json;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    assert.ok(offset + length <= bytes.length, `${key}: complete chunk`);
    if (type === 0x4e4f534a) json = JSON.parse(bytes.toString('utf8', offset, offset + length).trim());
    chunks.push({type, bytes: length}); offset += length;
  }
  assert.equal(json?.asset?.version, '2.0'); assert.ok(json.meshes?.length > 0);
  const uris = [];
  const visit = value => {if (!value || typeof value !== 'object') return; for (const [name, item] of Object.entries(value)) {if (name === 'uri') uris.push(item); else visit(item);}};
  visit(json);
  assert.ok(uris.every(uri => typeof uri === 'string' && uri.startsWith('data:')), `${key}: GLB must embed all buffers/textures; no external paths`);
  return {key, bytes: bytes.length, sha256: sha(bytes), chunks, meshCount: json.meshes.length, materialCount: json.materials?.length || 0, textureCount: json.textures?.length || 0, uris};
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('long-night-mvp-v1')).state);
const seed = async (page, state) => {
  await page.evaluate(state => localStorage.setItem('long-night-mvp-v1', JSON.stringify({schema: 3, state})), state);
  await page.reload(); await click(page, 'load');
};
async function harness(intercept) {
  const context = await browser.newContext({viewport: {width: 1100, height: 760}});
  if (intercept) await context.route('**/assets/props/*.glb', intercept);
  const page = await context.newPage(); watch(page, !!intercept);
  await page.route('**/guest-props-harness.html', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas id="world"></canvas>'}));
  await page.goto(`${base}/guest-props-harness.html`);
  await page.evaluate(async () => {const W = await import('/src/world.js'); if (!W.init()) throw Error('WebGL unavailable');});
  return {context, page};
}
async function draw(page, id, mode, preload = false, type = 'standard', away = false) {
  return page.evaluate(async ({id, mode, preload, type, away}) => {
    const W = await import('/src/world.js'), {PEOPLE} = await import('/src/content.js');
    const g = {...PEOPLE.flat().find(g => g.id === id), number: '103', side: 0, z: 9, type, away, alive: true, on: true, dark: 0, emergency: 0};
    if (preload) await W.preloadProps();
    W.setMode(mode, [], g); W.update([], false, null, 0);
    // No await between setMode and render: even one old-model frame must fail.
    return W.getCharacterState();
  }, {id, mode, preload, type, away});
}

try {
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await context.newPage(); watch(page); await page.goto(base);
  for (const key of keys) {
    const path = `/assets/props/${key}-v1.glb`, response = await context.request.get(base + path);
    assert.equal(response.status(), 200, path);
    assets.push({path, ...parseGlb(await response.body(), key)});
  }
  await writeFile(`${out}/asset-results.json`, JSON.stringify(assets, null, 2));

  const generatedNights = {};
  for (const [dayIndex, roster] of PEOPLE.entries()) {
    if (dayIndex === 0) {await click(page, 'new'); await click(page, 'enter');}
    else await seed(page, {...fixture, phase: 'reception', day: 2, receptionIndex: 0, roster: structuredClone(roster), guests: [], rooms: [], actors: {}, clues: fixture.clues.filter(c => c.guest === 'hotel'), events: [], refused: 0, enemy: null, paused: false});
    for (const guest of roster) {
      const {id} = guest;
      assert.equal(await page.locator('.conversation h2').textContent(), guest.name);
      assert.equal(await page.locator('.conversation .facts').textContent(), '', `${id}: model loading cannot reveal evidence`);
      const state = await waitProps(page, id); checkProps(state.props, id);
      assert.equal(await page.locator('.conversation .facts').textContent(), '', `${id}: ready model adds no evidence`);
      states[`main-${id}`] = state;
      if (['lin', 'tang', 'luo'].includes(id)) await shot(page, `${id}/main-reception`);
      if (id === 'tang') {
        for (let i = 0; i < 3; i++) {await click(page, 'documents'); await click(page, 'close');}
        checkProps((await world(page)).props, id);
        assert.equal(await page.locator('.conversation .facts').textContent(), '');
      }
      await click(page, 'ask0'); await click(page, 'ask0');
      const facts = await page.locator('.conversation .facts').textContent();
      assert.equal(facts.split(guest.facts[0]).length - 1, 1, `${id}: original button adds one clue, idempotently`);
      assert.ok(!facts.includes(guest.facts[1]), `${id}: hidden second account stays hidden`);
      await click(page, 'accept');
      const clues = (await saved(page)).clues.filter(clue => clue.guest === id);
      assert.deepEqual(clues.map(clue => [clue.id, clue.text]), [[id + '0', guest.facts[0]]]);
    }
    await click(page, 'auto'); await click(page, 'night'); await click(page, 'close');
    generatedNights[dayIndex + 1] = await saved(page);
  }
  // Camera photographs become textual evidence only through the original
  // observation action. Suite walls still prevent that action creating a clue.
  for (const [id, day, type] of [['xu', 1, 'standard'], ['gu', 2, 'standard'], ['gu', 2, 'suite']]) {
    const night = structuredClone(generatedNights[day]), room = night.rooms.find(room => room.id === id);
    room.type = type; night.player = {x: 0, z: room.z}; night.stage = 'tour'; night.actors = {}; night.enemy = null;
    night.clues = night.clues.filter(clue => clue.id !== id + 'night');
    await seed(page, night);
    await page.mouse.move(720, 350); await page.mouse.down();
    await page.evaluate(yaw => window.dispatchEvent(new MouseEvent('mousemove', {movementX: -yaw / .003, bubbles: true})), room.side === 0 ? Math.PI / 2 : -Math.PI / 2);
    await page.mouse.up(); await page.keyboard.press('e'); await click(page, 'peep');
    if (type === 'suite') assert.deepEqual((await world(page)).props, []);
    else {const state = await waitProps(page, id, 'peep'); checkProps(state.props, id);}
    assert.match(await page.locator('.peephole-footer').textContent(), /先看看/);
    await shot(page, `${id}/main-peep-${type}`);
    await click(page, 'observe');
    const footer = await page.locator('.peephole-footer').textContent();
    assert.ok(type === 'suite' ? footer.includes('内间门关着') : footer.includes(OBSERVATIONS[id]));
    await click(page, 'close'); await page.keyboard.press('Tab');
    const journal = await page.locator('.modal').textContent();
    assert.equal(journal.includes(OBSERVATIONS[id]), type !== 'suite', 'photo evidence requires an unobstructed observation and explicit recording');
    await click(page, 'close');
    states[`photo-evidence-${id}-${type}`] = {recorded: type !== 'suite', explicitObserve: true};
  }

  const preview = await context.newPage(); watch(preview); await preview.goto(`${base}/character-preview.html`);
  await preview.waitForFunction(() => document.body.dataset.ready === 'true');
  const waitPreview = (id, view, room) => waitState(() => previewState(preview), state => state.guest === id && state.view === view && (!room || state.room === room) && (room === 'suite' ? state.props.length === 0 : state.props.length === layouts[id].length && state.props.every(prop => prop.kind === 'model')), `${id}/${view}/${room}`);
  for (const {id} of guests) {
    await preview.locator('#guest-select').selectOption(id); await preview.locator('[data-view="reception"]').click();
    let state = await waitPreview(id, 'reception'); checkProps(state.props, id); states[`preview-${id}-reception`] = state;
    await shot(preview, `${id}/preview-reception`);
    await preview.locator('#toggle-props').click(); assert.equal((await previewState(preview)).closeup, true);
    await shot(preview, `${id}/closeup-reception`);
    await preview.locator('#toggle-props').click(); assert.equal((await previewState(preview)).closeup, false);
    await preview.locator('[data-view="peep"]').click(); await preview.locator('[data-room="standard"]').click();
    state = await waitPreview(id, 'peep', 'standard'); checkProps(state.props, id); states[`preview-${id}-standard`] = state;
    await shot(preview, `${id}/peep-standard`);
    await preview.locator('[data-room="suite"]').click(); state = await waitPreview(id, 'peep', 'suite');
    assert.deepEqual(state.props, []); assert.equal(await preview.locator('#toggle-props').isVisible(), false);
    states[`preview-${id}-suite`] = state; await shot(preview, `${id}/peep-suite`);
    await preview.locator('[data-room="away"]').click(); state = await waitPreview(id, 'peep', 'away'); checkProps(state.props, id);
    assert.equal(state.characters.find(character => character.id === id).visible, false);
    states[`preview-${id}-away`] = state;
    if (['tang', 'gu'].includes(id)) await shot(preview, `${id}/peep-away`);
  }
  const rapid = await preview.evaluate(() => {
    const states = [], picker = document.querySelector('#guest-select');
    for (const id of ['lin', 'zhou', 'tang', 'luo', 'gu', 'chen', 'xu', 'tang']) {
      picker.value = id; picker.dispatchEvent(new Event('change', {bubbles: true}));
      document.querySelector('[data-view="reception"]').click();
      document.querySelector('#toggle-props').click(); document.querySelector('#toggle-props').click();
      document.querySelector('[data-view="peep"]').click(); document.querySelector('[data-room="standard"]').click();
      states.push(JSON.parse(document.querySelector('#preview-state').textContent));
    }
    document.querySelector('[data-view="corridor"]').click();
    states.push(JSON.parse(document.querySelector('#preview-state').textContent)); return states;
  });
  for (const state of rapid.slice(0, -1)) checkProps(state.props, state.guest);
  assert.deepEqual(rapid.at(-1).props, []); assert.equal(rapid.at(-1).closeup, false); states.rapidSwitches = rapid;
  await context.close();

  // Observe disposal on the actual loaded GLTF resources, not on unrelated
  // procedural room meshes. Instrumentation lives only in this isolated page.
  const warm = await harness();
  const tracker = await warm.page.evaluateHandle(async () => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(url => url.includes('GLTFLoader'));
    if (!url) throw Error('Actual GLTFLoader module URL unavailable');
    const {GLTFLoader} = await import(url), original = GLTFLoader.prototype.parse;
    const record = {loads: 0, resources: 0, disposals: []}, seen = new Set();
    GLTFLoader.prototype.parse = function(data, path, onLoad, onError) {
      return original.call(this, data, path, result => {
        record.loads++;
        const track = resource => {if (!resource || seen.has(resource)) return; seen.add(resource); record.resources++; resource.addEventListener('dispose', () => record.disposals.push(resource.type || resource.constructor.name));};
        result.scene.traverse(object => {track(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) {track(material); for (const value of Object.values(material)) if (value?.isTexture) track(value);}});
        onLoad(result);
      }, onError);
    };
    return record;
  });
  await warm.page.evaluate(async () => {const W = await import('/src/world.js'); await W.preloadProps(); await W.preloadCharacters();});
  const warmStates = [];
  for (let repeat = 0; repeat < 2; repeat++) for (const id of ids) for (const mode of ['reception', 'peep']) {
    const state = await draw(warm.page, id, mode); checkProps(state.props, id); warmStates.push({repeat, id, mode, props: state.props});
  }
  states.warmFirstFrames = warmStates;
  const tracking = await tracker.jsonValue();
  assert.equal(tracking.loads, 7, 'each model parsed once, including shared Xu/Gu camera');
  assert.ok(tracking.resources > 0); assert.deepEqual(tracking.disposals, [], 'scene cleanup must not dispose cached GLTF resources');
  states.cacheResources = tracking; await tracker.dispose(); await warm.context.close();

  let releaseCold; const coldGate = new Promise(resolve => releaseCold = resolve);
  const cold = await harness(async route => {await coldGate; await route.continue();});
  const coldStates = [];
  for (const id of ids) {const state = await draw(cold.page, id, 'reception'); checkProps(state.props, id, 'loading'); coldStates.push(state);}
  await shot(cold.page, 'cold-pending-last-guest'); releaseCold();
  await cold.page.evaluate(async () => {const W = await import('/src/world.js'); await W.preloadProps(); W.update([], false, null, 0);});
  const ready = await world(cold.page); checkProps(ready.props, 'gu');
  await shot(cold.page, 'cold-ready-last-guest'); states.cold = {pending: coldStates, ready}; await cold.context.close();

  const failed = await harness(route => route.abort('failed'));
  await failed.page.evaluate(async () => {const W = await import('/src/world.js'); await W.preloadProps(); await W.preloadCharacters();});
  states.failures = [];
  for (const id of ids) for (const mode of ['reception', 'peep']) {
    const state = await draw(failed.page, id, mode); checkProps(state.props, id, 'fallback'); states.failures.push(state);
    if (id === 'tang' || id === 'zhou' && mode === 'reception') await shot(failed.page, `${id}/failed-${mode}`);
  }
  await failed.context.close();

  let releaseLate; const lateGate = new Promise(resolve => releaseLate = resolve);
  const late = await harness(async route => {await lateGate; await route.continue();});
  await draw(late.page, 'tang', 'reception');
  const abandoned = await late.page.evaluateHandle(async () => {
    const W = await import('/src/world.js'), P = await import('/src/guest-props.js');
    const threeUrl = performance.getEntriesByType('resource').map(entry => entry.name).find(url => new URL(url).pathname.endsWith('/three.js'));
    const T = await import(threeUrl), group = P.createProp(P.propLayout('tang')[0], new T.Group(), {guestId: 'tang', tableY: 0});
    P.propController(group).dispose(); W.setMode('title', []); W.update([], false, null, 0); return group;
  });
  releaseLate();
  const afterLeave = await late.page.evaluate(async group => {
    const W = await import('/src/world.js'); await W.preloadProps('medicine-case'); await Promise.resolve(); W.update([], false, null, 0);
    return {state: W.getCharacterState(), abandonedModel: !!group.getObjectByName('prop-model'), abandonedFallback: group.getObjectByName('prop-fallback').visible};
  }, abandoned);
  assert.deepEqual(afterLeave.state.props, []); assert.equal(afterLeave.abandonedModel, false); assert.equal(afterLeave.abandonedFallback, false);
  const reused = await draw(late.page, 'tang', 'reception'); checkProps(reused.props, 'tang');
  states.leaveBeforeResolve = {afterLeave, reused}; await shot(late.page, 'late-load-reused-cache');
  await abandoned.dispose(); await late.context.close();
  assert.deepEqual(errors, [], 'browser runtime and unexpected resource failures');
  await writeFile(`${out}/result.json`, JSON.stringify({passed: true, base, browser: await browser.version(), assets, states, screenshots, errors, expectedResourceErrors,
    fixture: {source: fixturePath, sha256: sha(fixtureBytes), isolatedLocalStorage: true, dayOne: 'actual new game', receptionDayTwo: 'derived checkpoint', cameraNight: 'generated from actual reception and layout, positioned beside selected room'},
    boundary: 'Focused belongings, cache lifetime, and explicit evidence actions; visual acceptance recorded separately.'}, null, 2));
  console.log(`PASS guest props: ${assets.length} embedded GLBs, ${screenshots.length} focused screenshots`);
} catch (error) {
  await writeFile(`${out}/result.json`, JSON.stringify({passed: false, error: error.stack, assets, states, screenshots, errors, expectedResourceErrors}, null, 2));
  throw error;
} finally {await browser.close();}
