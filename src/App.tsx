import './App.css'
import { Galaxy } from './scene/Galaxy'
import { ThumbnailScene } from './scene/ThumbnailScene'

function App() {
  const searchParams = new URLSearchParams(window.location.search)
  const isThumbnailMode =
    searchParams.has('thumbnail') || window.location.hash === '#thumbnail'

  if (isThumbnailMode) {
    return <ThumbnailScene />
  }

  return <Galaxy />
}

export default App
