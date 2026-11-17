import { expect, test } from '@playwright/test';

/** Mounts markup into the fixture page and waits for upgrade + slotchange. */
async function mount(page, html, { url = '/tests/fixture.html' } = {}) {
  await page.goto(url);
  await page.evaluate((markup) => {
    document.getElementById('root').innerHTML = markup;
  }, html);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
}

const btn = (page, n) => page.locator('jazz-accordion-item').nth(n).locator('button.trigger');
const expanded = (page, n) => btn(page, n).getAttribute('aria-expanded');
const panelVisible = (page, n) =>
  page.locator('jazz-accordion-item').nth(n).evaluate((el) => {
    const panel = el.shadowRoot.querySelector('.panel');
    return panel.getBoundingClientRect().height > 0;
  });

const THREE = `
  <jazz-accordion no-animation>
    <jazz-accordion-item id="a" label="Alpha">Alpha content</jazz-accordion-item>
    <jazz-accordion-item id="b" label="Beta">Beta content médico</jazz-accordion-item>
    <jazz-accordion-item id="c" label="Gamma">Gamma content</jazz-accordion-item>
  </jazz-accordion>`;

test.describe('basics & ARIA', () => {
  test('renders a button with aria-expanded and a labelled region', async ({ page }) => {
    await mount(page, THREE);
    await expect(btn(page, 0)).toHaveText('Alpha');
    expect(await expanded(page, 0)).toBe('false');
    const info = await page.locator('#a').evaluate((el) => {
      const p = el.shadowRoot.querySelector('.panel');
      const head = el.shadowRoot.querySelector('.heading');
      return { role: p.getAttribute('role'), by: p.getAttribute('aria-labelledby'), level: head.getAttribute('aria-level'), hidden: p.getAttribute('hidden') };
    });
    expect(info).toEqual({ role: 'region', by: 'trigger', level: '3', hidden: 'until-found' });
    expect(await panelVisible(page, 0)).toBe(false);
  });

  test('click toggles the panel', async ({ page }) => {
    await mount(page, THREE);
    await btn(page, 0).click();
    expect(await expanded(page, 0)).toBe('true');
    expect(await panelVisible(page, 0)).toBe(true);
    await expect(page.locator('#a')).toHaveAttribute('open', '');
    await btn(page, 0).click();
    expect(await expanded(page, 0)).toBe('false');
  });

  test('single mode closes the others; multiple keeps them', async ({ page }) => {
    await mount(page, THREE);
    await btn(page, 0).click();
    await btn(page, 1).click();
    expect(await expanded(page, 0)).toBe('false');
    expect(await expanded(page, 1)).toBe('true');

    await page.locator('jazz-accordion').evaluate((el) => (el.multiple = true));
    await btn(page, 2).click();
    expect(await expanded(page, 1)).toBe('true');
    expect(await expanded(page, 2)).toBe('true');
  });

  test('only the first initially open item survives in single mode', async ({ page }) => {
    await mount(page, `<jazz-accordion no-animation>
      <jazz-accordion-item label="1" open>1</jazz-accordion-item>
      <jazz-accordion-item label="2" open>2</jazz-accordion-item></jazz-accordion>`);
    expect(await expanded(page, 0)).toBe('true');
    expect(await expanded(page, 1)).toBe('false');
  });

  test('heading-level is configurable and clamped', async ({ page }) => {
    await mount(page, `<jazz-accordion heading-level="2"><jazz-accordion-item label="x">x</jazz-accordion-item>
      <jazz-accordion-item label="y" heading-level="99">y</jazz-accordion-item></jazz-accordion>`);
    const levels = await page.locator('jazz-accordion-item').evaluateAll((els) => els.map((e) => e.shadowRoot.querySelector('.heading').getAttribute('aria-level')));
    expect(levels).toEqual(['2', '6']);
  });

  test('legacy title attribute becomes the label (no tooltip)', async ({ page }) => {
    await mount(page, `<jazz-accordion><jazz-accordion-item title="Legacy">x</jazz-accordion-item></jazz-accordion>`);
    await expect(btn(page, 0)).toHaveText('Legacy');
    await expect(page.locator('jazz-accordion-item')).not.toHaveAttribute('title', /.*/);
  });

  test('label is rendered as text, never as HTML', async ({ page }) => {
    await mount(page, `<jazz-accordion><jazz-accordion-item label="<img src=x onerror=window.pwned=1>">x</jazz-accordion-item></jazz-accordion>`);
    await expect(btn(page, 0)).toHaveText('<img src=x onerror=window.pwned=1>');
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  });

  test('themes can choose the indicator via --jz-indicator; attributes win', async ({ page }) => {
    await mount(page, `<style>jazz-accordion { --jz-indicator: plus; }</style>
      <jazz-accordion><jazz-accordion-item label="a">a</jazz-accordion-item>
      <jazz-accordion-item label="b" indicator="arrow">b</jazz-accordion-item></jazz-accordion>`);
    const types = await page.locator('jazz-accordion-item').evaluateAll((els) => els.map((e) => e.shadowRoot.querySelector('.item').dataset.indicator));
    expect(types).toEqual(['plus', 'arrow']);
  });

  test('region role is dropped when more than 6 panels can be open (APG)', async ({ page }) => {
    const items = Array.from({ length: 7 }, (_, i) => `<jazz-accordion-item label="${i}">${i}</jazz-accordion-item>`).join('');
    await mount(page, `<jazz-accordion multiple>${items}</jazz-accordion>`);
    const role = await page.locator('jazz-accordion-item').first().evaluate((el) => el.shadowRoot.querySelector('.panel').getAttribute('role'));
    expect(role).toBeNull();
  });
});

test.describe('keyboard', () => {
  test('arrows, Home and End move focus between headers; Enter/Space toggle', async ({ page }) => {
    await mount(page, THREE);
    await btn(page, 0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(btn(page, 1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(btn(page, 2)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(btn(page, 0)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(btn(page, 2)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(btn(page, 0)).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await expanded(page, 0)).toBe('true');
    await page.keyboard.press('Space');
    expect(await expanded(page, 0)).toBe('false');
  });
});

test.describe('states & events', () => {
  test('disabled items cannot be toggled by the user', async ({ page }) => {
    await mount(page, `<jazz-accordion no-animation><jazz-accordion-item label="x" disabled>x</jazz-accordion-item></jazz-accordion>`);
    await btn(page, 0).click({ force: true });
    expect(await expanded(page, 0)).toBe('false');
    await expect(btn(page, 0)).toHaveAttribute('aria-disabled', 'true');
  });

  test('always-open keeps one panel open and marks it aria-disabled', async ({ page }) => {
    await mount(page, `<jazz-accordion always-open no-animation>
      <jazz-accordion-item label="1">1</jazz-accordion-item><jazz-accordion-item label="2">2</jazz-accordion-item></jazz-accordion>`);
    expect(await expanded(page, 0)).toBe('true');
    await expect(btn(page, 0)).toHaveAttribute('aria-disabled', 'true');
    await btn(page, 0).click({ force: true });
    expect(await expanded(page, 0)).toBe('true');
    await btn(page, 1).click();
    expect(await expanded(page, 0)).toBe('false');
    expect(await expanded(page, 1)).toBe('true');
  });

  test('jazz-before-toggle can cancel; jazz-toggle reports source', async ({ page }) => {
    await mount(page, THREE);
    await page.evaluate(() => {
      window.log = [];
      const acc = document.querySelector('jazz-accordion');
      acc.addEventListener('jazz-before-toggle', (e) => { if (e.detail.item.id === 'b') e.preventDefault(); });
      acc.addEventListener('jazz-toggle', (e) => window.log.push(`${e.detail.item.id}:${e.detail.open}:${e.detail.source}`));
    });
    await btn(page, 1).click();
    expect(await expanded(page, 1)).toBe('false');
    await btn(page, 0).click();
    await page.locator('jazz-accordion').evaluate((el) => el.expand('c'));
    expect(await page.evaluate(() => window.log)).toEqual(['a:true:user', 'a:false:group', 'c:true:api']);
  });

  test('API: expandAll / collapseAll / getItem by index and id', async ({ page }) => {
    await mount(page, THREE);
    const r = await page.locator('jazz-accordion').evaluate((el) => {
      const single = el.expandAll();
      el.multiple = true;
      el.expandAll();
      const all = el.openItems.length;
      el.collapseAll();
      return { single, all, after: el.openItems.length, byIdx: el.getItem(1).id, byId: el.getItem('c').label };
    });
    expect(r).toEqual({ single: false, all: 3, after: 0, byIdx: 'b', byId: 'Gamma' });
  });

  test('works without a parent accordion', async ({ page }) => {
    await mount(page, `<jazz-accordion-item label="Solo" no-animation>Solo content</jazz-accordion-item>`);
    await btn(page, 0).click();
    expect(await expanded(page, 0)).toBe('true');
  });

  test('animates height and ends fully open', async ({ page }) => {
    await mount(page, `<jazz-accordion style="--jz-duration: 600ms"><jazz-accordion-item label="A">${'Line<br>'.repeat(10)}</jazz-accordion-item></jazz-accordion>`);
    const done = page.evaluate(() => new Promise((r) => document.addEventListener('jazz-after-toggle', () => r(true), { once: true })));
    await btn(page, 0).click();
    const midway = await page.locator('jazz-accordion-item').evaluate((el) => el.shadowRoot.querySelector('.panel').getAnimations().length);
    expect(midway).toBe(1);
    expect(await done).toBe(true);
    expect(await panelVisible(page, 0)).toBe(true);
  });
});

test.describe('print', () => {
  test('collapsed panels are printed by default', async ({ page }) => {
    await mount(page, THREE);
    await page.emulateMedia({ media: 'print' });
    expect(await panelVisible(page, 0)).toBe(true);
    expect(await panelVisible(page, 2)).toBe(true);
  });

  test('print="collapsed" hides even open panels; print="as-is" keeps state', async ({ page }) => {
    await mount(page, `<jazz-accordion multiple no-animation>
      <jazz-accordion-item label="1" open print="collapsed">1</jazz-accordion-item>
      <jazz-accordion-item label="2" print="as-is">2</jazz-accordion-item>
      <jazz-accordion-item label="3" print="as-is" open>3</jazz-accordion-item></jazz-accordion>`);
    await page.emulateMedia({ media: 'print' });
    expect(await panelVisible(page, 0)).toBe(false);
    expect(await panelVisible(page, 1)).toBe(false);
    expect(await panelVisible(page, 2)).toBe(true);
  });

  test('disabled closed items are not leaked to paper', async ({ page }) => {
    await mount(page, `<jazz-accordion><jazz-accordion-item label="Secret" disabled>Classified</jazz-accordion-item></jazz-accordion>`);
    await page.emulateMedia({ media: 'print' });
    expect(await panelVisible(page, 0)).toBe(false);
  });

  test('theme colors, glows and clip-paths are reset to ink-friendly values', async ({ page }) => {
    await mount(page, `<style>
        jazz-accordion { --jz-header-color: rgb(0, 255, 255); --jz-item-bg: rgb(0, 0, 0); }
        jazz-accordion > jazz-accordion-item::part(trigger) { text-shadow: 0 0 8px cyan; }
        jazz-accordion > jazz-accordion-item::part(item) { clip-path: inset(4px); }
      </style>
      <jazz-accordion><jazz-accordion-item label="A">a</jazz-accordion-item></jazz-accordion>`);
    const read = () => page.locator('jazz-accordion-item').evaluate((el) => {
      const t = getComputedStyle(el.shadowRoot.querySelector('.trigger'));
      const i = getComputedStyle(el.shadowRoot.querySelector('.item'));
      return [t.color, t.textShadow, i.clipPath, i.backgroundColor];
    });
    expect((await read())[0]).toBe('rgb(0, 255, 255)');
    await page.emulateMedia({ media: 'print' });
    expect(await read()).toEqual(['rgb(0, 0, 0)', 'none', 'none', 'rgba(0, 0, 0, 0)']);
  });

  test('lazy content is rendered before printing', async ({ page }) => {
    await mount(page, `<jazz-accordion><jazz-accordion-item label="L" lazy><template><p id="lazy">Lazy!</p></template></jazz-accordion-item></jazz-accordion>`);
    await expect(page.locator('#lazy')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(page.locator('#lazy')).toHaveCount(1);
  });
});

test.describe('find-in-page, lazy, search', () => {
  test('beforematch (Ctrl+F) opens the item', async ({ page }) => {
    await mount(page, THREE);
    await page.locator('#c').evaluate((el) => el.shadowRoot.querySelector('.panel').dispatchEvent(new Event('beforematch')));
    expect(await expanded(page, 2)).toBe('true');
  });

  test('lazy template renders on first open', async ({ page }) => {
    await mount(page, `<jazz-accordion no-animation><jazz-accordion-item label="L" lazy><template><p id="lazy">Lazy!</p></template></jazz-accordion-item></jazz-accordion>`);
    await btn(page, 0).click();
    await expect(page.locator('#lazy')).toHaveText('Lazy!');
  });

  test('search filters (accent-insensitive), announces and restores', async ({ page }) => {
    await mount(page, THREE.replace('<jazz-accordion', '<jazz-accordion search results-label="{count} found"'));
    const search = page.locator('jazz-accordion').locator('input.search');
    await search.fill('MEDICO');
    await expect(page.locator('#a')).toBeHidden();
    await expect(page.locator('#b')).toBeVisible();
    await expect(page.locator('jazz-accordion').locator('.status')).toHaveText('1 found');
    expect(await page.evaluate(() => CSS.highlights.get('jazz-accordion-match')?.size)).toBe(1);
    await search.press('Escape');
    await expect(page.locator('#a')).toBeVisible();
    await expect(page.locator('jazz-accordion').locator('.status')).toHaveText('');
  });

  test('search never un-hides items the author hid', async ({ page }) => {
    await mount(page, `<jazz-accordion><jazz-accordion-item label="x" hidden>x</jazz-accordion-item><jazz-accordion-item label="y">y</jazz-accordion-item></jazz-accordion>`);
    const count = await page.locator('jazz-accordion').evaluate((el) => { el.filter('y'); el.filter(''); return el.items[0].hidden; });
    expect(count).toBe(true);
  });

  test('controls appear only in multiple mode', async ({ page }) => {
    await mount(page, THREE.replace('<jazz-accordion', '<jazz-accordion controls'));
    await expect(page.locator('jazz-accordion').locator('.controls')).toBeHidden();
    await page.locator('jazz-accordion').evaluate((el) => (el.multiple = true));
    await page.locator('jazz-accordion').getByRole('button', { name: 'Expand all' }).click();
    expect(await page.locator('jazz-accordion').evaluate((el) => el.openItems.length)).toBe(3);
  });
});

test.describe('deep link, persistence, SEO', () => {
  test('#hash opens the item and its ancestors in nested accordions', async ({ page }) => {
    await page.goto('/tests/fixture.html#inner');
    await page.evaluate(() => {
      document.getElementById('root').innerHTML = `
        <jazz-accordion deep-link no-animation>
          <jazz-accordion-item id="outer" label="Outer">
            <jazz-accordion no-animation>
              <jazz-accordion-item id="inner" label="Inner">Deep</jazz-accordion-item>
            </jazz-accordion>
          </jazz-accordion-item>
        </jazz-accordion>`;
    });
    await expect(page.locator('#outer')).toHaveAttribute('open', '');
    await expect(page.locator('#inner')).toHaveAttribute('open', '');
  });

  test('persist restores open items after reload', async ({ page }) => {
    const html = `<jazz-accordion multiple persist="t1" no-animation>
      <jazz-accordion-item label="1">1</jazz-accordion-item><jazz-accordion-item label="2">2</jazz-accordion-item></jazz-accordion>`;
    await mount(page, html);
    await page.evaluate(() => localStorage.clear());
    await btn(page, 1).click();
    await mount(page, html);
    expect(await expanded(page, 0)).toBe('false');
    expect(await expanded(page, 1)).toBe('true');
  });

  test('corrupted persisted data is ignored safely', async ({ page }) => {
    await page.goto('/tests/fixture.html');
    await page.evaluate(() => localStorage.setItem('jazz-accordion:bad', '{"__proto__":1'));
    await mount(page, `<jazz-accordion persist="bad"><jazz-accordion-item label="1">1</jazz-accordion-item></jazz-accordion>`);
    expect(await expanded(page, 0)).toBe('false');
  });

  test('faq-schema emits valid FAQPage JSON-LD and cleans up', async ({ page }) => {
    await mount(page, `<jazz-accordion faq-schema>
      <jazz-accordion-item label="Q1?">A1 &lt;/script&gt;</jazz-accordion-item>
      <jazz-accordion-item label="Q2?"><span slot="subtitle">sub</span>A2</jazz-accordion-item></jazz-accordion>`);
    const data = await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent));
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual([['Q1?', 'A1 </script>'], ['Q2?', 'A2']]);
    await page.evaluate(() => document.querySelector('jazz-accordion').remove());
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });
});
