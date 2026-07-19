"""End-to-end verify the fix against the live production URL."""
import asyncio
from playwright.async_api import async_playwright

URL = "https://aura-browser-xzg9o.ondigitalocean.app/"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True, args=["--no-sandbox"],
            executable_path="/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome",
        )
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        print(f"Loading {URL}...")
        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        body = await page.text_content("body")
        assert "AURA" in body, "AURA branding missing"
        print("  AURA branding: OK")

        # The exact query the user complained about
        print("\nSearching: 'houses for sale in florida'")
        await page.fill('input[placeholder*="Search"]', "houses for sale in florida")
        await page.press('input[placeholder*="Search"]', "Enter")

        # Wait for results
        try:
            await page.wait_for_function(
                """() => {
                    const t = document.body.textContent || '';
                    return /About \\d+ result/.test(t) ||
                           t.includes('Top places to look') ||
                           t.includes('No results');
                }""",
                timeout=45000,
            )
        except Exception as e:
            print(f"  Search timed out: {e}")

        await page.wait_for_timeout(2000)
        body = await page.text_content("body")

        # Verify the fix worked
        results = {
            "Real estate portals visible": "Zillow" in body or "Realtor" in body or "Redfin" in body,
            "Versailles (the bug) GONE": "Versailles" not in body,
            "Wikipedia card hidden": "via Wikipedia card" not in body,
            "Real Florida listings shown": "Florida" in body,
            "Commercial intent detected": "Top places to look" in body,
        }
        for k, v in results.items():
            mark = "✅" if v else "❌"
            print(f"  {mark} {k}")

        # Take a screenshot
        await page.screenshot(
            path="/workspace/aura-browser/fix-live-florida.png", full_page=False
        )
        print("\nScreenshot: fix-live-florida.png")

        await browser.close()


asyncio.run(main())
