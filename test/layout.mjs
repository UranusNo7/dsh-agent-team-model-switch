/**
 * Layout regression test for the "成员模型" popover.
 *
 * The panel is absolutely positioned with `right:0` inside the conversation
 * header. That header renders the control immediately after the session title,
 * so a short title puts the trigger near the left edge and the 400px panel
 * spills outside the viewport, clipping its left content (name + hint).
 *
 * This test extracts the *shipped* panel CSS and the shipped `placePanel`
 * function text from `lib/client.js`, rebuilds the shell header geometry from
 * the packaged stylesheet, and measures the real box in headless Chromium.
 * It fails if the panel leaves the viewport again, or if the reproduction
 * stops reproducing (which would mean the harness no longer models the bug).
 *
 * Chromium is auto-detected (or set EDGE_PATH); when absent the test reports
 * SKIPPED instead of pretending to pass.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/** Pull one `var NAME = '...'` declaration verbatim. */
function token(name) {
  const match = source.match(new RegExp(`var ${name} = ('[^']*')`))
  if (match === null) throw new Error(`token ${name} not found in lib/client.js`)
  return match[1]
}

/** Pull the whole `var CSS = [...] .join('')` expression verbatim. */
function cssExpression() {
  const start = source.indexOf('var CSS = [')
  const end = source.indexOf(".join('')", start)
  if (start === -1 || end === -1) throw new Error('CSS expression not found in lib/client.js')
  return source.slice(start + 'var CSS = '.length, end)
}

/** Pull the `placePanel` function body verbatim by brace matching. */
function placePanelSource() {
  const start = source.indexOf('function placePanel()')
  if (start === -1) throw new Error('placePanel not found in lib/client.js')
  let depth = 0
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error('placePanel braces unbalanced')
}

/** Header geometry copied from the packaged ConversationRoot stylesheet. */
const SHELL_CSS = `
.conv-header{box-sizing:border-box;border-bottom:.5px solid #444;flex:none;
grid-template-columns:auto minmax(0,1fr);min-height:76px;padding:10px 28px 0 20px;display:grid;position:relative;overflow:visible}
.titleRow{min-height:30px;grid-column:2;align-items:center;gap:0;display:flex;container-type:inline-size}
 .titleRow.clip{overflow:hidden}
 .titleRow.capture{transform:translateZ(0)}
.titleCluster{flex:1;align-items:center;gap:10px;min-width:0;display:flex}
.headerLeading{flex:none;grid-area:1/1;align-items:center;gap:8px;display:flex}
.crumbs{white-space:nowrap;align-items:center;gap:4px;min-width:0;display:flex;overflow:hidden}
.crumb{border-radius:6px;max-width:220px;color:#bbb;text-overflow:ellipsis;white-space:nowrap;
background:0 0;border:none;padding:4px 8px;font-size:14px;line-height:20px;display:inline-block;overflow:hidden}
.headerActions{flex:none;align-items:center;gap:8px;display:flex}
`

const TITLES = { short: '短', long: '一个比较长的会话名称用于测试布局', empty: '' }
const CASES = [
  { title: 'short', size: '1000,700', mode: '' },
  { title: 'long', size: '1000,700', mode: '' },
  { title: 'empty', size: '1000,700', mode: '' },
  { title: 'short', size: '420,700', mode: 'clip capture' },
  { title: 'long', size: '420,700', mode: 'capture' },
  { title: 'short', size: '504,700', mode: 'capture zoom' }
]

function harnessHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#1b1b1b;color:#eee;font:13px/1.5 sans-serif}
${SHELL_CSS}</style></head><body>
<div class="conv-header"><div class="headerLeading"></div>
<div class="titleRow"><div class="titleCluster">
<div class="crumbs" id="crumbs"></div><div class="headerActions" id="actions"></div>
</div></div></div><pre id="out">pending</pre><script>
var SURFACE = ${token('SURFACE')}, NESTED = ${token('NESTED')}, BORDER = ${token('BORDER')}
var BORDER_STRONG = ${token('BORDER_STRONG')}, LABEL = ${token('LABEL')}
var LABEL_DIM = ${token('LABEL_DIM')}, BRAND = ${token('BRAND')}
var CSS = ${cssExpression()}.join('')
var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style)

/* shipped implementation, under a stubbed ref holder */
var panelRef = { current: null }
var rootRef = { current: null }
${placePanelSource()}

var params = new URLSearchParams(location.search)
var titles = ${JSON.stringify(TITLES)}
var crumbs = document.getElementById('crumbs')
var titleRow = document.querySelector('.titleRow')
var mode = params.get('mode') || ''
if (mode.indexOf('clip') !== -1) titleRow.classList.add('clip')
if (mode.indexOf('capture') !== -1) titleRow.classList.add('capture')
if (mode.indexOf('zoom') !== -1) document.body.style.zoom = '1.1'
var crumb = document.createElement('button'); crumb.className = 'crumb'
crumb.textContent = titles[params.get('title')]
crumbs.appendChild(crumb)
var root = document.createElement('div'); root.className = 'atms-root'
rootRef.current = root
root.appendChild(Object.assign(document.createElement('button'), { textContent: '成员模型' }))
var panel = document.createElement('div'); panel.className = 'atms-panel'
for (var i = 0; i < 3; i += 1) {
  panel.appendChild(Object.assign(document.createElement('div'), { textContent: '「全部队员」= 一次切换整队' }))
}
root.appendChild(panel)
document.getElementById('actions').appendChild(root)
panelRef.current = panel

panel.style.position = 'absolute'
panel.style.left = 'auto'
panel.style.top = 'calc(100% + 8px)'
panel.style.right = '0px'
panel.style.transform = ''
var oldBox = panel.getBoundingClientRect()
panel.style.position = 'fixed'
panel.style.right = 'auto'
panel.style.left = '0px'
panel.style.top = '0px'
panel.style.transform = ''
var before = panel.getBoundingClientRect()
var beforeBox = { left: before.left, right: before.right }
placePanel()
var after = panel.getBoundingClientRect()
document.getElementById('out').textContent = JSON.stringify({
  unshiftedLeft: Math.round(beforeBox.left),
   oldAbsoluteLeft: Math.round(oldBox.left),
  placedLeft: Math.round(after.left),
  placedRight: Math.round(after.right),
  viewport: window.innerWidth,
  inViewport: after.left >= 7.5 && after.right <= window.innerWidth - 7.5
})
</script></body></html>`
}

function chromium() {
  const candidates = [process.env.EDGE_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)
  return candidates.find((path) => existsSync(path))
}

const chrome = chromium()
if (chrome === undefined) {
  console.log('SKIPPED: no Chromium found; set EDGE_PATH to run the layout test')
  process.exit(0)
}

const dir = mkdtempSync(join(tmpdir(), 'atms-layout-'))
const page = join(dir, 'harness.html')
writeFileSync(page, harnessHtml())
const failures = []
for (const item of CASES) {
  const out = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', `--window-size=${item.size}`, `--user-data-dir=${join(dir, 'p')}`,
    '--virtual-time-budget=3000', '--dump-dom', `file:///${page.replace(/\\/g, '/')}?title=${item.title}&mode=${encodeURIComponent(item.mode)}`],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const result = JSON.parse(out.match(/<pre id="out">(.*?)<\/pre>/s)[1])
  const label = `${item.title}@${item.size}`
  const reproduced = item.title === 'short' || item.title === 'long'
    ? result.oldAbsoluteLeft < 0
    : true
  console.log(`${result.inViewport && reproduced ? 'PASS' : 'FAIL'} ${label} ` +
    `unshiftedLeft=${result.unshiftedLeft} oldAbsoluteLeft=${result.oldAbsoluteLeft} placed=${result.placedLeft}..${result.placedRight} vw=${result.viewport}`)
  if ((item.title === 'short' || item.title === 'long') && result.oldAbsoluteLeft >= 0) failures.push(`${label}: old absolute no longer reproduces left overflow`)
  if (!result.inViewport) failures.push(`${label}: panel leaves the viewport`)
  if (!reproduced) failures.push(`${label}: harness no longer reproduces the offset bug`)
}
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('all layout cases passed')
