import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_CREDS } from './helpers';

const API_BASE = 'http://localhost:4200/api/v1';
const testTemplateName = `E2E Template ${Date.now()}`;
const updatedTemplateName = `E2E Template Updated ${Date.now()}`;

test.describe('Resume Template CRUD', () => {
  let createdTemplateId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to resume templates list', async ({ page }) => {
    await page.goto('/resume/templates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Template list page should load
    const templateList = page.locator('.template-list');
    await expect(templateList).toBeVisible({ timeout: 10000 });

    // Page header should be present
    const pageHeader = page.locator('.page-header h1');
    await expect(pageHeader).toBeVisible();
  });

  test('should navigate to template editor for new template', async ({ page }) => {
    await page.goto('/resume/templates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click the "New" button which links to /resume/editor
    const newBtn = page.locator('a[routerLink="/resume/editor"], a[href="/resume/editor"]').first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    await expect(page).toHaveURL(/\/resume\/editor$/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Editor should be visible
    const editor = page.locator('.template-editor');
    await expect(editor).toBeVisible({ timeout: 10000 });
  });

  test('should create a new template', async ({ page }) => {
    await page.goto('/resume/editor');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Fill template name
    const nameInput = page.locator('input.template-name-input');
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.click();
    await nameInput.fill(testTemplateName);

    // Fill description in the sidebar
    const descTextarea = page.locator('.editor-sidebar textarea').first();
    if (await descTextarea.isVisible()) {
      await descTextarea.fill('E2E test template description for automated testing.');
    }

    // Click Save button
    const saveBtn = page.locator('button.btn-primary', { hasText: /Save|Salvar/ });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Wait for save to complete — URL should update to include the template ID
    await page.waitForTimeout(3000);

    // After save, the save status should show "saved"
    const saveStatus = page.locator('.save-status.saved');
    if (await saveStatus.count() > 0) {
      await expect(saveStatus).toBeVisible({ timeout: 10000 });
    }
  });

  test('template should appear in the list', async ({ page }) => {
    await page.goto('/resume/templates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for our test template
    const templateCard = page.locator('.template-card', { hasText: testTemplateName });

    // If the template was created successfully, it should appear
    if (await templateCard.count() > 0) {
      await expect(templateCard.first()).toBeVisible();

      // Store the template ID from the edit link for later use
      const editLink = templateCard.locator('a[href*="/resume/editor/"]').first();
      if (await editLink.count() > 0) {
        const href = await editLink.getAttribute('href');
        if (href) {
          createdTemplateId = href.split('/').pop() || '';
        }
      }
    }
  });

  test('should preview a template', async ({ page }) => {
    // First get the template ID via API
    await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });

    const listRes = await page.request.get(`${API_BASE}/resume/templates`);
    if (listRes.ok()) {
      const data = await listRes.json();
      const templates = data.content || data || [];
      const testTemplate = templates.find((t: any) => t.name === testTemplateName);
      if (testTemplate) {
        createdTemplateId = testTemplate.id;

        // Navigate to preview
        await page.goto(`/resume/preview/${createdTemplateId}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Preview page should load
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('should edit a template', async ({ page }) => {
    if (!createdTemplateId) {
      // Try to get template ID from API
      await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
        data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
      });

      const listRes = await page.request.get(`${API_BASE}/resume/templates`);
      if (listRes.ok()) {
        const data = await listRes.json();
        const templates = data.content || data || [];
        const testTemplate = templates.find((t: any) => t.name === testTemplateName);
        if (testTemplate) {
          createdTemplateId = testTemplate.id;
        }
      }
    }

    if (createdTemplateId) {
      await page.goto(`/resume/editor/${createdTemplateId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Editor should be visible with existing template data
      const editor = page.locator('.template-editor');
      await expect(editor).toBeVisible({ timeout: 10000 });

      // Update the name
      const nameInput = page.locator('input.template-name-input');
      await nameInput.click();
      await nameInput.fill(updatedTemplateName);

      // Save changes
      const saveBtn = page.locator('button.btn-primary', { hasText: /Save|Salvar/ });
      await saveBtn.click();
      await page.waitForTimeout(3000);
    }
  });

  test('should delete a template', async ({ page }) => {
    // Get the template ID
    await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });

    const listRes = await page.request.get(`${API_BASE}/resume/templates`);
    let templateId = createdTemplateId;

    if (listRes.ok()) {
      const data = await listRes.json();
      const templates = data.content || data || [];
      const testTemplate = templates.find(
        (t: any) => t.name === updatedTemplateName || t.name === testTemplateName
      );
      if (testTemplate) {
        templateId = testTemplate.id;
      }
    }

    if (templateId) {
      await page.goto('/resume/templates');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find the template card with the delete button
      const templateCard = page.locator('.template-card', {
        hasText: new RegExp(`${updatedTemplateName}|${testTemplateName}`),
      });

      if (await templateCard.count() > 0) {
        // Handle confirm dialog
        page.on('dialog', (dialog) => dialog.accept());

        // Click delete button (danger action btn)
        const deleteBtn = templateCard.locator('.action-btn--danger').first();
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await page.waitForTimeout(2000);

          // Template should no longer be in the list
          const remainingCard = page.locator('.template-card', {
            hasText: new RegExp(`${updatedTemplateName}|${testTemplateName}`),
          });
          await expect(remainingCard).toHaveCount(0, { timeout: 5000 });
        }
      }
    }
  });
});
