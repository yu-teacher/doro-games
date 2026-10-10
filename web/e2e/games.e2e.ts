import { expect, test, type Page } from '@playwright/test';
import { auditMobile, formatViolations, type AuditOptions } from './mobileAudit';
import { mockApi } from './fixtures';

/** 화면이 자리 잡을 때까지 기다린 뒤 모바일 문제를 모두 모아 한 번에 보여 준다. */
async function expectMobileFriendly(page: Page, options: AuditOptions = {}) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const violations = await auditMobile(page, options);
  expect(violations, `모바일에서 깨지는 곳이 있습니다:\n${formatViolations(violations)}`).toEqual([]);
}

for (const loggedIn of [false, true]) {
  const who = loggedIn ? '로그인' : '비로그인';

  test.describe(`게임 천국: ${who}`, () => {
    test.beforeEach(async ({ page }) => mockApi(page, { loggedIn }));

    test('게임 목록', async ({ page }) => {
      await page.goto('/games/');
      await expect(page.getByText('도로 러너').first()).toBeVisible();
      await expectMobileFriendly(page);
    });

    test('러너 게임 화면(랭킹·조작 버튼)', async ({ page }) => {
      await page.goto('/games/g/runner');
      await expect(page.getByRole('heading', { name: '도로 러너' }).or(page.locator('canvas')).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: '랭킹' })).toBeVisible();
      await expectMobileFriendly(page);
    });
  });
}
