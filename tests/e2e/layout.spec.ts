import { test, expect } from '@playwright/test';

test.describe('Server-Driven UI Layout Adaptability E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to local Vite dev server
    await page.goto('/');

    // Complete token-based reviewer auth login
    await page.locator('#email').fill('reviewer_antigravity@domain.com');
    await page.locator('#password').fill('MonsoonAlertSecurePass2026!');
    await page.locator('button[type="submit"]').click();

    // Verify successful login transition to main engine title
    await expect(page.locator('h1')).toContainText('Monsoon Resilience Engine');
  });

  test('should boot in default state and display primary weather card', async ({ page }) => {
    // Verify that the page titles and weather details render
    await expect(page.locator('h1')).toContainText('Monsoon Resilience Engine');
    await expect(page.locator('#weather-card-element')).toBeVisible();
  });

  test('should shift dynamically to flash flood EMERGENCY layout', async ({ page }) => {
    // Select Chennai simulation (Emergency Phase)
    const select = page.locator('select').first();
    await select.selectOption({ label: 'Chennai (Flash Flood Emergency)' });

    // 1. Critical Banner should render
    const banner = page.locator('#alert-banner-element');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveClass(/critical/);
    await expect(banner).toContainText('Flash Flood & Cyclone Warning');

    // 2. Checklist element should contain emergency items
    await expect(page.locator('#checklist-card-element')).toContainText('Immediate Safety Actions');

    // 3. Evacuation map should render
    await expect(page.locator('#evacuation-map-element')).toBeVisible();

    // 4. Rescue Request form should be visible
    await expect(page.locator('#assistance-form-element')).toContainText('Request Rescue / Emergency Assistance');
  });

  test('should shift dynamically to dry PRE_MONSOON layout', async ({ page }) => {
    // Select Jodhpur simulation (Preparedness Phase)
    const select = page.locator('select').first();
    await select.selectOption({ label: 'Jodhpur (Pre-Monsoon Preparedness)' });

    // 1. Info Banner should render
    const banner = page.locator('#alert-banner-element');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveClass(/info/);
    await expect(banner).toContainText('PRE-MONSOON RESILIENCE ACTIVE');

    // 2. Checklist should show preparedness items
    await expect(page.locator('#checklist-card-element')).toContainText('Household Preparedness Guidelines');

    // 3. Evacuation map should NOT render (no active threat)
    await expect(page.locator('#evacuation-map-element')).not.toBeVisible();
    await expect(page.locator('#assistance-form-element')).not.toBeVisible();
  });
});
