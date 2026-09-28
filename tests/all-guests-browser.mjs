import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PEOPLE} from '../src/content.js';

// Day one follows the actual new-game reception. Day two uses the existing
// generated checkpoint in an isolated browser context, never the user's browser.
const base = process.env.CHARACTER_ART_BASE_URL || 'http://127.0.0.1:4173';
const out = 'verification/all-guests-v1';
const guests = PEOPLE.flat();
const ids = guests.map(guest => guest.id);
const fixturePath = 'verification/fixed-rooms/night-fixture.json';
const fixtureBytes = await readFile(fixturePath);
const night = JSON.parse(fixtureBytes);
const dayTwo = {...night, phase: 'reception', day: 2, receptionIndex: 0,
  roster: structuredClone(PEOPLE[1]), guests: [], rooms: [], actors: {}, events: [],
  clues: night.clues.filter(clue => clue.guest === 'hotel'), refused: 0,
  investigation: {checksLeft: 2, guests: {}}, enemy: null, paused: false};
await mkdir(out, {recursive: true});
for (const id of ids) await mkdir(`${out}/${id}`, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 900}});
const errors = [], expectedResourceErrors = [], warnings = [], assets = [], screenshots = [];
const states = {}, neutralPortraits = {}, mainSequence = [];
const sha = value => createHash('sha256').update(value).digest('hex');
const watch = page => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (message.location().url.endsWith('/favicon.ico') && /404/.test(message.text())) {
      expectedResourceErrors.push(message.text());
    } else errors.push(`${message.location().url}: ${message.text()}`);
  });
};
const shot = async (page, name) => {
  await page.waitForTimeout(120);
  await page.screenshot({path: `${out}/${name}.png`});
  screenshots.push(`${name}.png`);
};
const click = (page, act) => page.locator(`[data-act="${act}"]`).click();
const character = (state, id) => state.characters.find(item => item.id === id);
const readWorld = page => page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map(entry => entry.name)
    .find(url => new URL(url).pathname === '/src/world.js');
  if (!url) throw Error('No loaded application renderer');
  return (await import(url)).getCharacterState();
});
const readPortrait = (page, id) => page.evaluate(async id => {
  const url = performance.getEntriesByType('resource').map(entry => entry.name)
    .find(url => new URL(url).pathname === '/src/world.js');
  return (await import(url)).portrait(id);
}, id);
const waitState = async (read, predicate, label) => {
  let state;
  for (let attempt = 0; attempt < 100; attempt++) {
    state = await read();
    if (predicate(state)) return state;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(predicate(state), `${label}: ${JSON.stringify(state)}`);
};
const waitMain = (page, id, expression) => waitState(() => readWorld(page), state =>
  state.mode === 'reception' && character(state, id)?.kind === 'sprite' &&
  character(state, id)?.expression === expression, `${id} main ${expression}`);
const readPreview = async page => JSON.parse(await page.locator('#preview-state').textContent());
const waitPreview = (page, id, view, extra = () => true) => waitState(() => readPreview(page), state =>
  state.guest === id && state.view === view && character(state, id)?.kind === 'sprite' && extra(state), `${id} preview ${view}`);
const noOverflow = async page => {
  const overflow = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth > innerWidth + 1,
    controls: [...document.querySelectorAll('button:not([hidden]),select,.identity-photo img')]
      .filter(element => element.getClientRects().length)
      .filter(element => {const box = element.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1;})
      .map(element => element.textContent.trim()),
  }));
  assert.deepEqual(overflow, {body: false, controls: []});
};

try {
  const page = await context.newPage(); watch(page); await page.goto(base);
  for (const {id} of guests) for (const kind of ['directions', 'expressions']) {
    const version = id === 'tang' ? 'v2' : 'v1';
    const path = `/assets/characters/${id}/${id}-${kind}-${version}.png`;
    const response = await context.request.get(`${base}${path}`);
    assert.equal(response.status(), 200, path);
    const bytes = await response.body();
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', path);
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    assert.deepEqual([width, height], [1536, 1024], `${path} atlas contract`);
    const frames = await page.evaluate(async path => {
      const image = new Image(); image.src = path; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width / 3; canvas.height = image.height;
      const ctx = canvas.getContext('2d', {willReadFrequently: true});
      return [0, 1, 2].map(frame => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, frame * canvas.width, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const bounds = {left: canvas.width, right: 0, top: canvas.height, bottom: 0};
        let transparent = 0, opaque = 0, maxAlpha = 0;
        for (let i = 3; i < data.length; i += 4) {
          const alpha = data[i]; maxAlpha = Math.max(maxAlpha, alpha);
          if (alpha === 0) transparent++;
          if (alpha > 220) opaque++;
          if (alpha >= 102) {
            const pixel = (i - 3) / 4, x = pixel % canvas.width, y = Math.floor(pixel / canvas.width);
            bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x + 1);
            bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y + 1);
          }
        }
        const corners = [3, canvas.width * 4 - 1, (canvas.height - 1) * canvas.width * 4 + 3, data.length - 1].map(index => data[index]);
        return {frame, bounds, transparent, opaque, maxAlpha, corners, image: canvas.toDataURL()};
      });
    }, path);
    for (const frame of frames) {
      assert.ok(frame.transparent > 100 && frame.opaque > 100, `${path}/${frame.frame}: transparent figure`);
      assert.deepEqual(frame.corners, [0, 0, 0, 0], `${path}/${frame.frame}: transparent corners`);
      const gutter = Math.min(frame.bounds.left, width / 3 - frame.bounds.right);
      assert.ok(gutter >= 2, `${path}/${frame.frame}: hard cell-edge margin`);
      if (gutter < 30) warnings.push(`${path} frame ${frame.frame}: ${gutter}px gutter below 30px target`);
    }
    assert.equal(new Set(frames.map(frame => frame.image)).size, 3, `${path}: three authored frames`);
    assets.push({id, kind, path, width, height, sha256: sha(bytes), frames: frames.map(({image, ...frame}) => frame)});
  }
  await writeFile(`${out}/atlas-results.json`, JSON.stringify({assets, warnings}, null, 2));

  for (const [dayIndex, roster] of PEOPLE.entries()) {
    if (dayIndex === 0) {await click(page, 'new'); await click(page, 'enter');}
    else {
      await page.evaluate(state => localStorage.setItem('long-night-mvp-v1', JSON.stringify({schema: 3, state})), dayTwo);
      await page.reload(); await click(page, 'load');
    }
    for (const guest of roster) {
      const {id, name} = guest; states[id] = {main: {}, preview: {}};
      assert.equal(await page.locator('.conversation h2').textContent(), name);
      for (const [expression, action] of [['neutral', null], ['explaining', 'ask0'], ['guarded', 'ask1']]) {
        if (action) await click(page, action);
        const state = await waitMain(page, id, expression);
        assert.deepEqual(state.characters.filter(item => item.visible).map(item => item.id), [id], 'no other guest survives reception switch');
        states[id].main[expression] = state;
        await shot(page, `${id}/main-${expression}`);
        const portrait = await readPortrait(page, id);
        assert.ok(portrait.startsWith('data:image/png'), `${id}: authored neutral portrait`);
        if (!neutralPortraits[id]) neutralPortraits[id] = portrait;
        assert.equal(portrait, neutralPortraits[id], `${id}: ID does not inherit conversation expression`);
      }
      await writeFile(`${out}/${id}/neutral-id.png`, Buffer.from(neutralPortraits[id].split(',')[1], 'base64'));
      if (dayIndex === 1) {
        await click(page, 'documents');
        const portrait = page.locator('.identity-photo img'); await portrait.evaluate(image => image.decode());
        assert.equal(await portrait.getAttribute('src'), neutralPortraits[id], `${id}: actual identity paper uses matching guest`);
        await shot(page, `${id}/main-identity-paper`); await click(page, 'close');
      } else assert.equal(await page.locator('[data-act="documents"]').count(), 0, 'day-one rules stay unchanged');
      await page.setViewportSize({width: 900, height: 800}); await noOverflow(page);
      if (['lin', 'luo'].includes(id)) await shot(page, `${id}/narrow-main`);
      await page.setViewportSize({width: 1440, height: 900});
      mainSequence.push({day: dayIndex + 1, id, name, portraitSha256: sha(neutralPortraits[id])});
      await click(page, 'accept');
    }
    assert.equal(await page.locator('.fixed-layout').count(), 1);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('long-night-mvp-v1')).state);
    assert.deepEqual(saved.guests.map(guest => guest.id), roster.map(guest => guest.id));
    assert.equal(saved.phase, 'layout');
  }
  assert.equal(new Set(Object.values(neutralPortraits).map(sha)).size, 7, 'seven distinct identities');

  const preview = await context.newPage(); watch(preview);
  await preview.goto(`${base}/character-preview.html`);
  await preview.waitForFunction(() => document.body.dataset.ready === 'true');
  assert.deepEqual(await preview.locator('#guest-select option').evaluateAll(options => options.map(option => option.value)), ids);
  const setLight = async light => {
    if ((await readPreview(preview)).light !== light) await preview.locator('#toggle-light').click();
  };
  for (const {id, name} of guests) {
    await preview.locator('#guest-select').selectOption(id);
    await preview.locator('[data-view="reception"]').click(); await setLight(true);
    for (const expression of ['neutral', 'guarded', 'explaining']) {
      await preview.locator(`[data-expression="${expression}"]`).click();
      const state = await waitPreview(preview, id, 'reception', state => character(state, id).expression === expression);
      assert.deepEqual(state.characters.filter(item => item.visible).map(item => item.id), [id]);
      states[id].preview[expression] = state;
      await preview.locator('#portrait-preview').evaluate(image => image.decode());
      assert.equal(await preview.locator('#portrait-preview').getAttribute('src'), neutralPortraits[id]);
      assert.equal(await preview.locator('#guest-name').textContent(), name);
    }
    await preview.locator('[data-view="peep"]').click();
    for (const room of ['standard', 'suite', 'away']) {
      await preview.locator(`[data-room="${room}"]`).click();
      const state = await waitPreview(preview, id, 'peep', state => state.room === room);
      assert.equal(character(state, id).visible, room !== 'away');
      states[id].preview[`peep-${room}`] = state;
      if (room === 'standard' || ['tang', 'luo'].includes(id)) await shot(preview, `${id}/peep-${room}`);
    }
    await preview.locator('[data-view="corridor"]').click();
    const frames = new Set();
    for (const angle of ['front', 'side', 'back']) {
      await preview.locator(`[data-angle="${angle}"]`).click();
      for (const light of [true, false]) {
        await setLight(light);
        const state = await waitPreview(preview, id, 'corridor', state => state.angle === angle && state.light === light && character(state, id).frame === angle);
        const c = character(state, id);
        assert.equal(c.visible, true); assert.equal(c.billboard, 'vertical');
        assert.ok(c.alphaTest > 0); assert.equal(c.depthWrite, true);
        assert.deepEqual([c.planeRotation[0], c.planeRotation[2]], [0, 0]);
        frames.add(c.frame); states[id].preview[`corridor-${angle}-${light ? 'on' : 'off'}`] = state;
        if (light || angle === 'front') await shot(preview, `${id}/corridor-${angle}-${light ? 'on' : 'off'}`);
      }
    }
    assert.equal(frames.size, 3);
    await preview.setViewportSize({width: 900, height: 800}); await noOverflow(preview);
    if (['lin', 'luo'].includes(id)) await shot(preview, `${id}/narrow-preview`);
    await preview.setViewportSize({width: 1440, height: 900});
  }
  // A failed portrait atlas on a newly selected guest must never retain the
  // previous guest's photo, including the synchronous native change event.
  const failedContext = await browser.newContext({viewport: {width: 1440, height: 900}});
  await failedContext.route('**/assets/characters/lin/lin-expressions-v1.png', route => route.abort('failed'));
  const failedPreview = await failedContext.newPage();
  failedPreview.on('pageerror', error => errors.push(error.message));
  failedPreview.on('console', message => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    if (url.endsWith('/lin-expressions-v1.png') && message.text().includes('ERR_FAILED')) expectedResourceErrors.push(message.text());
    else if (url.endsWith('/favicon.ico') && message.text().includes('404')) expectedResourceErrors.push(message.text());
    else errors.push(`${url}: ${message.text()}`);
  });
  await failedPreview.goto(`${base}/character-preview.html`);
  await failedPreview.waitForFunction(() => document.body.dataset.ready === 'true');
  await waitPreview(failedPreview, 'tang', 'reception');
  await failedPreview.locator('[data-view="corridor"]').click();
  await waitPreview(failedPreview, 'tang', 'corridor');
  const originalPortrait = await failedPreview.locator('#portrait-preview').getAttribute('src');
  assert.equal(originalPortrait, neutralPortraits.tang);
  const immediate = await failedPreview.evaluate(() => {
    const picker = document.querySelector('#guest-select'); picker.value = 'lin';
    picker.dispatchEvent(new Event('change', {bubbles: true}));
    const image = document.querySelector('#portrait-preview');
    return {src: image.getAttribute('src'), hidden: image.hidden, alt: image.alt,
      name: document.querySelector('#portrait-name').textContent};
  });
  assert.notEqual(immediate.src, originalPortrait, 'failed new guest clears previous ID in same change event');
  assert.deepEqual(immediate, {src: null, hidden: true, alt: '林姨的中性神态证件照', name: '林姨'});
  const failedState = await waitPreview(failedPreview, 'lin', 'corridor');
  assert.equal(failedState.assetsByGuest.lin.expressions, 'failed');
  assert.equal(await failedPreview.locator('#portrait-preview').getAttribute('src'), null);
  await shot(failedPreview, 'failed-portrait-switch');
  await failedPreview.locator('#guest-select').selectOption('tang');
  await waitPreview(failedPreview, 'tang', 'corridor');
  assert.equal(await failedPreview.locator('#portrait-preview').getAttribute('src'), originalPortrait);
  assert.equal(await failedPreview.locator('#portrait-preview').evaluate(image => image.hidden), false);
  await shot(failedPreview, 'failed-portrait-restored');
  states.failedPortraitSwitch = {immediate, settled: failedState, restoredTang: true};
  await failedContext.close();
  assert.deepEqual(errors, [], 'runtime and unexpected resource errors');
  await writeFile(`${out}/result.json`, JSON.stringify({passed: true, base, browser: await browser.version(),
    fixture: {source: fixturePath, sha256: sha(fixtureBytes), isolatedLocalStorage: true, dayOne: 'actual new-game reception', dayTwo: 'derived reception checkpoint'},
    ids, mainSequence, assets, states, screenshots, errors, expectedResourceErrors, warnings,
    boundary: 'Real reception sequence and shared-renderer preview checks. Scene-transition and Luo pursuit geometry are checked by character-transition-browser.mjs. Visual review remains separate from assertions.'}, null, 2));
  console.log(`PASS all seven guests: ${assets.length} atlases, ${screenshots.length} screenshots`);
} catch (error) {
  await writeFile(`${out}/result.json`, JSON.stringify({passed: false, error: error.stack, ids, mainSequence,
    assets, states, screenshots, errors, expectedResourceErrors, warnings}, null, 2));
  throw error;
} finally {await browser.close();}
