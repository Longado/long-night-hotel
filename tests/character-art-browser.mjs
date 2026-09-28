import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Isolated visual acceptance fixture. This writes only this fresh browser context's
// localStorage; it does not add game cheats or alter the player's saved browser.
const base = process.env.CHARACTER_ART_BASE_URL || 'http://127.0.0.1:4173';
const out = process.env.CHARACTER_ART_OUT || 'verification/all-guests-v1/tang-regression';
const fixturePath = 'verification/fixed-rooms/night-fixture.json';
const fixtureBytes = await readFile(fixturePath);
const night = JSON.parse(fixtureBytes);
assert.equal(night.day, 2);
assert.equal(night.roster[0].id, 'tang');
const reception = {...night, phase: 'reception', receptionIndex: 0, guests: [], rooms: [],
  clues: night.clues.filter(c => c.guest === 'hotel'), refused: 0, actors: {},
  events: [], investigation: {checksLeft: 2, guests: {}}, enemy: null, paused: false};
await mkdir(out, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 900}});
const errors = [], expectedResourceErrors = [], screenshots = [], states = {}, assets = [];
const watch = (page, expectedMissing = false) => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    if (msg.location().url.endsWith('/favicon.ico') && /404/.test(msg.text())) {
      expectedResourceErrors.push(`Browser favicon request: ${msg.text()}`);
      return;
    }
    if (expectedMissing && /Failed to load resource.*net::ERR_FAILED/.test(msg.text())) {
      expectedResourceErrors.push(msg.text());
    } else errors.push(msg.text());
  });
};
const shot = async (page, name) => {
  await page.waitForTimeout(150);
  await page.screenshot({path: `${out}/${name}.png`});
  screenshots.push(`${name}.png`);
};
const click = (page, action) => page.locator(`[data-act="${action}"]`).click();
// Vite may append an HMR version to the application's world module. Import that
// observed URL exactly, otherwise a bare URL can create a separate module instance.
const snapshot = page => page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map(entry => entry.name)
    .find(url => new URL(url).pathname === '/src/world.js');
  if (!url) throw new Error('Application world module has not loaded');
  return (await import(url)).getCharacterState();
});
const characters = value => Array.isArray(value) ? value : value.characters;
const tang = value => characters(value)?.find(c => c.id === 'tang');
const waitTang = async (page, expression) => {
  let state;
  for (let attempt = 0; attempt < 100; attempt++) {
    state = await snapshot(page);
    if (state.mode === 'reception' && tang(state)?.kind === 'sprite' && tang(state)?.expression === expression) break;
    await page.waitForTimeout(100);
  }
  assert.equal(state.mode, 'reception');
  assert.equal(tang(state)?.kind, 'sprite');
  assert.equal(tang(state)?.expression, expression);
  return state;
};
const previewState = async page => JSON.parse(await page.locator('#preview-state').textContent());
const noOverflow = async page => {
  const overflow = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth > innerWidth + 1,
    controls: [...document.querySelectorAll('button:not([hidden]), .identity-photo img')]
      .filter(el => el.getClientRects().length)
      .map(el => ({label: el.textContent.trim(), rect: el.getBoundingClientRect()}))
      .filter(({rect}) => rect.left < -1 || rect.right > innerWidth + 1)
      .map(({label}) => label),
  }));
  assert.deepEqual(overflow, {body: false, controls: []}, 'horizontal UI overflow');
};

try {
  const page = await context.newPage();
  watch(page);
  await page.goto(base);
  for (const file of ['tang-directions-v2.png', 'tang-expressions-v2.png']) {
    const path = `/assets/characters/tang/${file}`;
    const response = await context.request.get(`${base}${path}`);
    assert.equal(response.status(), 200, path);
    const body = await response.body();
    assert.equal(body.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const width = body.readUInt32BE(16), height = body.readUInt32BE(20);
    assert.equal(width % 3, 0, 'atlas must have three equal horizontal frames');
    assert.ok(width > 150 && height > 100);
    const frames = await page.evaluate(async path => {
      const image = new Image(); image.src = path; await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width / 3; canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      return [0, 1, 2].map(frame => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, frame * canvas.width, 0, canvas.width, canvas.height,
          0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparent = 0, opaque = 0;
        const bounds = {left: canvas.width, top: canvas.height, right: 0, bottom: 0};
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] === 0) transparent++;
          if (data[i] > 220) opaque++;
          if (data[i] >= 102) {
            const pixel = (i - 3) / 4, x = pixel % canvas.width, y = Math.floor(pixel / canvas.width);
            bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x + 1);
            bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y + 1);
          }
        }
        return {transparent, opaque, bounds, image: canvas.toDataURL()};
      });
    }, path);
    for (const frame of frames) {
      assert.ok(frame.transparent > 100, 'frame must retain transparent background');
      assert.ok(frame.opaque > 100, 'frame must contain a character');
      assert.ok(frame.bounds.left >= 2 && frame.bounds.right <= width / 3 - 2,
        'visible silhouette needs transparent cell-edge padding to avoid atlas bleeding');
    }
    assert.equal(new Set(frames.map(f => f.image)).size, 3, 'three different authored frames');
    assets.push({path, width, height, sha256: createHash('sha256').update(body).digest('hex'),
      frames: frames.map(({transparent, opaque, bounds}) => ({transparent, opaque, bounds}))});
  }
  await page.evaluate(state => localStorage.setItem('long-night-mvp-v1', JSON.stringify({schema: 3, state})), reception);
  await page.reload();
  await click(page, 'load');
  assert.equal(await page.locator('.conversation h2').textContent(), '唐宁');
  states.receptionNeutral = await waitTang(page, 'neutral');
  await shot(page, '01-reception-neutral');
  await click(page, 'ask0');
  states.receptionExplaining = await waitTang(page, 'explaining');
  await shot(page, '02-reception-explaining');
  await click(page, 'ask1');
  states.receptionGuarded = await waitTang(page, 'guarded');
  await shot(page, '03-reception-guarded');
  await click(page, 'documents');
  const identity = page.locator('.identity-photo img');
  await identity.evaluate(image => image.decode());
  const actualPortrait = await identity.getAttribute('src');
  assert.ok(actualPortrait?.startsWith('data:image/png') || actualPortrait?.includes('/assets/characters/tang/'));
  await shot(page, '04-neutral-id-photo');
  await noOverflow(page);
  await click(page, 'close');
  await page.setViewportSize({width: 900, height: 800});
  await noOverflow(page);
  await shot(page, 'narrow-900-reception');
  await click(page, 'documents');
  await noOverflow(page);
  await shot(page, 'narrow-900-identity');

  const preview = await context.newPage();
  watch(preview);
  await preview.goto(`${base}/character-preview.html`);
  await preview.waitForFunction(() => document.body.dataset.ready === 'true');
  for (const expression of ['neutral', 'guarded', 'explaining']) {
    await preview.locator(`[data-expression="${expression}"]`).click();
    await preview.waitForFunction(expression => JSON.parse(document.querySelector('#preview-state').textContent).expression === expression, expression);
    const state = await previewState(preview);
    assert.equal(tang(state)?.kind, 'sprite');
    assert.equal(tang(state)?.expression, expression);
    states[`previewReception${expression}`] = state;
  }
  const previewPortrait = await preview.locator('#portrait-preview').getAttribute('src');
  assert.equal(actualPortrait, previewPortrait, 'ID portrait stays neutral and shares the preview source');
  await preview.locator('[data-view="peep"]').click();
  for (const room of ['standard', 'suite', 'away']) {
    await preview.locator(`[data-room="${room}"]`).click();
    const state = await previewState(preview);
    assert.equal(state.room, room);
    assert.equal(tang(state)?.visible, room !== 'away', 'away guest must not appear inside room');
    states[`peep${room}`] = state;
    await shot(preview, `preview-peep-${room}`);
  }
  await preview.locator('[data-view="corridor"]').click();
  const directionalFrames = new Set();
  for (const angle of ['front', 'side', 'back']) {
    await preview.locator(`[data-angle="${angle}"]`).click();
    for (const light of [true, false]) {
      if ((await previewState(preview)).light !== light) await preview.locator('#toggle-light').click();
      await preview.waitForTimeout(200);
      const state = await previewState(preview), character = tang(state);
      assert.equal(state.angle, angle);
      assert.equal(state.light, light);
      assert.equal(character?.kind, 'sprite');
      assert.equal(character?.visible, true);
      assert.equal(character?.billboard, 'vertical');
      assert.ok(character.alphaTest > 0);
      assert.equal(character.depthWrite, true);
      directionalFrames.add(character.frame);
      states[`corridor${angle}${light ? 'On' : 'Off'}`] = state;
      await shot(preview, `preview-corridor-${angle}-light-${light ? 'on' : 'off'}`);
    }
  }
  assert.equal(directionalFrames.size, 3, 'front, side and back use different frames');
  await preview.setViewportSize({width: 900, height: 800});
  await noOverflow(preview);
  await shot(preview, 'narrow-900-preview');

  // A separate context deliberately aborts only Tang's atlas requests to exercise
  // the real renderer's low-poly fallback, without changing source or assets.
  const missingContext = await browser.newContext({viewport: {width: 1280, height: 800}});
  await missingContext.route('**/assets/characters/tang/*-v2.png', route => route.abort());
  const missing = await missingContext.newPage();
  watch(missing, true);
  await missing.goto(`${base}/character-preview.html`);
  await missing.waitForFunction(() => document.body.dataset.ready === 'true');
  for (const view of ['reception', 'peep', 'corridor']) {
    await missing.locator(`[data-view="${view}"]`).click();
    await missing.waitForTimeout(150);
    const state = await previewState(missing);
    assert.equal(tang(state)?.kind, 'fallback');
    assert.equal(tang(state)?.visible, true);
    states[`fallback${view}`] = state;
    await shot(missing, `fallback-${view}`);
  }
  await missingContext.close();
  assert.deepEqual(errors, [], 'browser runtime and unexpected console errors');
  await writeFile(`${out}/result.json`, JSON.stringify({passed: true,
    fixture: {source: fixturePath, sha256: createHash('sha256').update(fixtureBytes).digest('hex'),
      isolatedLocalStorage: true, mutation: 'derive day 2 reception; no production cheat mode'},
    browser: await browser.version(), base, assets, states, errors, expectedResourceErrors, screenshots,
    boundary: 'Actual day 2 reception from a controlled existing checkpoint; peep and corridor screenshots use the sample page and shared renderer. No claim of natural Tang corridor gameplay or full playtest. Appearance requires screenshot review.'}, null, 2));
  console.log(`PASS character art browser: ${screenshots.length} screenshots`);
} catch (error) {
  await writeFile(`${out}/result.json`, JSON.stringify({passed: false, error: error.stack, errors,
    expectedResourceErrors, screenshots, states, assets}, null, 2));
  throw error;
} finally {
  await browser.close();
}
