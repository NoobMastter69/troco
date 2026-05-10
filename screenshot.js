const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()

  async function startGame(viewport, prefix) {
    const page = await browser.newPage()
    await page.setViewportSize(viewport)
    await page.goto('http://localhost:5173')
    await page.waitForTimeout(600)
    await page.fill('input[placeholder="Como quer ser chamado?"]', 'Tester')
    await page.click('button:has-text("+ Criar Sala")')
    await page.waitForTimeout(1500)
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("+ Adicionar Bot")')
      await page.waitForTimeout(350)
    }
    await page.click('button:has-text("▶ Começar Jogo")')
    // Aguarda o jogo carregar (aparece a mão do jogador)
    await page.waitForSelector('.card-deal', { timeout: 8000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${prefix}_game.png` })
    console.log(`${prefix}_game.png ok`)
    await page.close()
  }

  await startGame({ width: 900, height: 620 }, 'ss_small')
  await startGame({ width: 1280, height: 800 }, 'ss_large')

  await browser.close()
  console.log('Pronto!')
})()
