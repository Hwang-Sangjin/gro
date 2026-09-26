let apiPromise;
export function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-grooves-youtube]');
    const created = !script;
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.dataset.groovesYoutube = 'true';
    }
    const finish = error => {
      clearInterval(poll);
      clearTimeout(timeout);
      script.removeEventListener('error', fail);
      if (error) { script.remove(); reject(error); }
      else resolve(window.YT);
    };
    const fail = () => finish(new Error('YouTube API unavailable'));
    // Avoid replacing an API-ready callback owned by another component.
    const poll = setInterval(() => { if (window.YT?.Player) finish(); }, 100);
    const timeout = setTimeout(fail, 12000);
    script.addEventListener('error', fail, { once: true });
    if (created) document.head.append(script);
  }).catch(error => { apiPromise = null; throw error; });
  return apiPromise;
}
