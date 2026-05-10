const { chromium } = require('playwright')

async function screenshotGame(page, label) {
  await page.screenshot({ path: `screenshot_${label}.png`, fullPage: false })
  console.log(`Saved screenshot_${label}.png`)
}

async function startGame(page) {
  // Fill name
  await page.fill('input[placeholder="Como quer ser chamado?"]', 'Tester')
  // Select Troço mode (second mode button)
  const modeButtons = page.locator('button:has-text("Troço")')
  await modeButtons.last().click()
  await page.waitForTimeout(300)
  // Create room
  await page.click('button:has-text("+ Criar Sala")')
  await page.waitForTimeout(1200)
  // Add 3 bots
  for (let i = 0; i < 3; i++) {
    const addBot = page.locator('button:has-text("Adicionar Bot")')
    if (await addBot.count() > 0) {
      await addBot.click()
      await page.waitForTimeout(500)
    }
  }
  // Start game
  const startBtn = page.locator('button:has-text("Começar Jogo")')
  if (await startBtn.count() > 0) {
    await startBtn.click()
    await page.waitForTimeout(3000)
  }
}

;(async () => {
  const viewports = [
    { name: 'desktop_1280', width: 1280, height: 800 },
    { name: 'mobile_iphone14', width: 390, height: 844 },
    { name: 'mobile_small', width: 375, height: 667 },
    { name: 'mobile_android', width: 412, height: 915 },
    { name: 'tablet', width: 768, height: 1024 },
  ]

  for (const vp of viewports) {
    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    await page.goto('http://localhost:5173')
    await startGame(page)
    // Wait for game to start (PlayerHand appears)
    await page.waitForSelector('.card-deal', { timeout: 12000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await screenshotGame(page, `${vp.name}_playing`)
    await browser.close()
    console.log(`Done: ${vp.name}`)
  }
})()
