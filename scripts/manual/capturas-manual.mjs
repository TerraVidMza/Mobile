/**
 * Capturas del manual de la app móvil (M-022).
 *
 * Recorre la exportación web (PWA) de la app con viewport de teléfono y
 * guarda cada pantalla en `src/manual/img/`. Necesita la API con los datos de
 * demostración y la PWA servida en http://localhost:8081 (ver README.md).
 *
 * Playwright no es dependencia de Mobile: se toma el de la Web, que ya lo
 * tiene instalado (`PLAYWRIGHT_DESDE` cambia de dónde).
 *
 *     node scripts/manual/capturas-manual.mjs
 */
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { mkdirSync, writeFileSync } from "node:fs"

const aqui = dirname(fileURLToPath(import.meta.url))
const require = createRequire(
  resolve(process.env.PLAYWRIGHT_DESDE ?? join(aqui, "../../../Web"), "package.json")
)
const { chromium } = require("@playwright/test")

const APP = process.env.MANUAL_APP_URL ?? "http://localhost:8081"
const DESTINO = join(aqui, "../../src/manual/img")
const TEXTOS = process.env.MANUAL_TEXTOS // carpeta opcional donde volcar el texto de cada pantalla
const EMAIL = process.env.MANUAL_EMAIL ?? "capataz@terravid.demo"
const PASSWORD = "Terravid123!"

mkdirSync(DESTINO, { recursive: true })
if (TEXTOS) mkdirSync(TEXTOS, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: "es-AR",
  geolocation: { latitude: -33.0362, longitude: -68.8833 },
  permissions: ["geolocation"],
})
const page = await ctx.newPage()
// En la exportación web las pestañas inactivas siguen en el DOM: solo sirve lo visible.
const id = (testId) => page.getByTestId(testId).filter({ visible: true }).first()
const texto = (t) => page.getByText(t).filter({ visible: true })
const pausa = (ms = 800) => page.waitForTimeout(ms)

// En la exportación web los avisos son `window.alert`, que no salen en una
// captura: se aceptan y se guarda el texto. En el teléfono son diálogos nativos.
const avisos = []
page.on("dialog", async (dialogo) => {
  avisos.push(dialogo.message())
  await dialogo.accept()
})
async function esperarAviso(desde) {
  for (let i = 0; i < 40 && avisos.length === desde; i++) await pausa(250)
  if (avisos.length === desde) throw new Error("no apareció el aviso")
  return avisos.at(-1)
}

async function foto(nombre, { completa = false } = {}) {
  await pausa()
  await page.screenshot({ path: join(DESTINO, `${nombre}.jpg`), type: "jpeg", quality: 82, fullPage: completa })
  if (TEXTOS) writeFileSync(join(TEXTOS, `${nombre}.txt`), await page.locator("body").innerText())
  console.log("ok", nombre)
}

async function elegir(selector, opcion) {
  try {
    await id(selector).click({ timeout: 10_000 })
    await pausa(500)
    const item = page.getByRole("menuitem", { name: opcion }).filter({ visible: true })
    await ((await item.count()) ? item : texto(opcion)).last().click({ timeout: 10_000, force: true })
    await pausa(400)
  } catch (error) {
    throw new Error(`${selector} → ${opcion}: ${error.message.split("\n")[0]}`)
  }
}

async function paso(nombre, accion) {
  try {
    await accion()
  } catch (error) {
    console.error("FALLÓ", nombre, error.message.split("\n")[0])
    // Un menú o diálogo abierto bloquearía los pasos siguientes.
    await page.goto(APP).catch(() => {})
    await pausa(3000)
  }
}

await page.goto(APP)
await id("input-email").waitFor({ timeout: 30_000 })
await foto("movil-login")

await id("input-email").fill(EMAIL)
await id("input-password").fill(PASSWORD)
await id("boton-ingresar").click()
await id("tab-inicio").waitFor({ timeout: 30_000 })
// Al entrar la app descarga fincas, cuarteles y catálogos para trabajar sin señal.
await pausa(5000)
await foto("movil-inicio")
await foto("movil-inicio-completo", { completa: true })

await paso("labores", async () => {
  await id("tab-labores").click()
  await foto("movil-labores")
})

await paso("nueva labor", async () => {
  await id("fab-nueva-labor").click()
  await texto("Nueva labor").first().waitFor()
  await foto("movil-nueva-labor")
  await elegir("selector-finca", "Los Viñedos")
  await elegir("selector-cuartel", /^Malbec Sur/)
  await elegir("selector-tipo-labor", /^Pulverización/)
  await id("input-cantidad").fill("12")
  await elegir("selector-insumo", /^Azufre mojable/)
  await id("input-insumo-cantidad").fill("20")
  await id("boton-agregar-insumo").click()
  await foto("movil-nueva-labor-completa", { completa: true })
  const previos = avisos.length
  await id("boton-guardar-labor").click()
  console.log("aviso:", JSON.stringify(await esperarAviso(previos)))
  await pausa(1500)
  await foto("movil-labores-con-nueva")
})

await paso("detalle labor", async () => {
  await texto(/Pulverización/).first().click()
  await foto("movil-labor-detalle")
  await page.goBack()
})

await paso("pesajes", async () => {
  await id("tab-pesaje").click()
  await foto("movil-pesajes")
  await id("fab-nuevo-pesaje").click()
  await texto("Nuevo pesaje").first().waitFor()
  await foto("movil-nuevo-pesaje")
  await elegir("selector-finca", "Los Viñedos")
  await elegir("selector-cuadrilla", "Cuadrilla Los Pérez")
  await elegir("selector-cuartel", /^Cabernet Este/)
  await id("input-peso-kg").fill("980")
  await foto("movil-nuevo-pesaje-completo", { completa: true })
  const previos = avisos.length
  await id("boton-guardar-pesaje").click()
  console.log("aviso:", JSON.stringify(await esperarAviso(previos)))
  await pausa(1500)
  await foto("movil-pesajes-con-nuevo")
})

await paso("avisos", async () => {
  await id("tab-avisos").click()
  await foto("movil-avisos")
})

await paso("ayuda", async () => {
  await id("tab-ayuda").click()
  await foto("movil-ayuda")
  await id("seccion-registrar-una-labor").click()
  await foto("movil-ayuda-seccion")
  await page.getByPlaceholder("Buscar en el manual...").filter({ visible: true }).fill("sincronizar")
  await foto("movil-ayuda-busqueda")
  await page.getByPlaceholder("Buscar en el manual...").filter({ visible: true }).fill("")
  await id("boton-pedir-ayuda").click()
  await texto("¿En qué parte?").waitFor()
  await id("modulo-vendimia").click()
  await id("input-descripcion-ayuda").fill(
    "No me aparece la Cuadrilla Norte en el formulario de pesaje."
  )
  await foto("movil-soporte")
})

await browser.close()
