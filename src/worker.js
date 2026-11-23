export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      return Response.redirect('https://' + url.host + url.pathname + url.search, 301);
    }
    return env.ASSETS.fetch(request);
  },
};
