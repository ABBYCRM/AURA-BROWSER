import asyncio
from playwright.async_api import async_playwright

URL = "https://aura-browser-xzg9o.ondigitalocean.app/"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, args=["--no-sandbox"],
            executable_path="/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome",
        )
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        await page.fill('input[placeholder*="Search"]', "houses for sale in florida")
        await page.press('input[placeholder*="Search"]', "Enter")
        # Wait for actual results to render (not just loading)
        await page.wait_for_function(
            """() => {
                const t = document.body.textContent || '';
                return t.includes('Florida Homes') || t.includes('Florida Real Estate') ||
                       t.includes('Top places to look');
            }""",
            timeout=60000,
        )
        await page.wait_for_timeout(5000)  # let results fully render
        body = await page.text_content("body")
        print("Body snippet (first 800):", body[:800])
        await page.screenshot(path="/workspace/aura-browser/fix-live-final.png", full_page=False)
        print("Screenshot: fix-live-final.png")
        await browser.close()

asyncio.run(main())
