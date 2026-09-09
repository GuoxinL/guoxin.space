const staticPaths = new Set(["/","/favicon.svg","/fonts/fusion-pixel-12px-zh_hans.woff2","/fonts/press-start-2p-latin.woff2","/img/pickaxe-src.png","/img/pickaxe.png","/json/","/q-manifest.json","/running/","/sitemap.xml","/skills/"]);
function isStaticPath(method, url) {
  if (method.toUpperCase() !== 'GET') {
    return false;
  }
  const p = url.pathname;
  if (p.startsWith("/build/")) {
    return true;
  }
  if (p.startsWith("/assets/")) {
    return true;
  }
  if (staticPaths.has(p)) {
    return true;
  }
  if (p.endsWith('/q-data.json')) {
    const pWithoutQdata = p.replace(/\/q-data.json$/, '');
    if (staticPaths.has(pWithoutQdata + '/')) {
      return true;
    }
    if (staticPaths.has(pWithoutQdata)) {
      return true;
    }
  }
  return false;
}
export { isStaticPath };