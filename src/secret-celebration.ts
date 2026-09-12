export function celebrateSecretMessage(host: HTMLElement): () => void {
  const shell = host.closest<HTMLElement>('.archive-dialog__shell')
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  if (!shell || motion.matches) return () => {}
  const layer = document.createElement('div')
  layer.className = 'secret-particles'
  layer.setAttribute('aria-hidden', 'true')
  shell.append(layer)
  const animations: Animation[] = []
  const colors = ['#b5ffe0', '#fff1c2', '#ffcfe3', '#c4e1ff', '#f5fff6']
  const width = shell.clientWidth
  const height = shell.clientHeight
  let disposed = false
  function destroy() {
    if (disposed) return
    disposed = true
    motion.removeEventListener('change', onMotion)
    animations.forEach(animation => animation.cancel())
    layer.remove()
  }
  function onMotion() { if (motion.matches) destroy() }
  motion.addEventListener('change', onMotion)
  for (let index = 0; index < 40; index++) {
    const particle = document.createElement('span')
    particle.className = index % 5 === 0 ? 'secret-particle secret-particle--spark' : 'secret-particle'
    particle.style.color = colors[index % colors.length]!
    const origin = .15 + (index % 3) * .35
    particle.style.left = `${origin * 100}%`
    particle.style.top = '72%'
    layer.append(particle)
    const spread = Math.sin(index * 2.399963) * width * .3
    const rise = height * (.3 + (index % 7) * .065)
    const rotation = index * 47
    animations.push(particle.animate([
      { transform: `translate3d(0, 0, 0) rotate(${rotation}deg) scale(.2)`, opacity: 0 },
      { opacity: .85, offset: .15 },
      { transform: `translate3d(${spread * .65}px, ${-rise * .7}px, 0) rotate(${rotation + 50}deg) scale(1)`, opacity: .65, offset: .6 },
      { transform: `translate3d(${spread}px, ${-rise}px, 0) rotate(${rotation + 95}deg) scale(.3)`, opacity: 0 },
    ], { duration: 2200 + (index % 7) * 160, delay: (index % 9) * 45, easing: 'cubic-bezier(.16,.6,.35,1)', fill: 'both' }))
  }
  void Promise.all(animations.map(animation => animation.finished)).then(destroy, destroy)
  return destroy
}