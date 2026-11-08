import { render } from 'preact'
import { App } from './App'
import { actions, hydrate } from './store'
import { bg } from './bus'
import './styles/app.css'

async function boot() {
  await hydrate()

  /* Service worker'a bu sekmenin bir viewer olduğunu bildir →
     iframe engelini kaldıran DNR kuralları yalnızca bu sekmeye uygulanır. */
  await bg({ t: 'registerViewer' })

  render(<App />, document.getElementById('app')!)

  /* Açılış adresi: ?url= parametresi ya da son kullanılan adres */
  const qs = new URLSearchParams(location.search)
  const initial = qs.get('url')
  if (initial) {
    actions.navigate(initial)
  } else {
    const got = await chrome.storage.local.get('rs_state_v1')
    const last = (got?.rs_state_v1 as { lastUrl?: string } | undefined)?.lastUrl
    if (last) actions.navigate(last)
  }
}

void boot()
