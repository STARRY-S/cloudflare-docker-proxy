addEventListener("fetch", (event) => {
  event.passThroughOnException();
  event.respondWith(handleRequest(event.request));
});

const routeAuths = {
  "docker.hxstarrys.me": "https://auth.docker.io/token",
  "quay.hxstarrys.me": "https://quay.io/auth",
  "gcr.hxstarrys.me": "https://gcr.io/auth",
  "k8s-gcr.hxstarrys.me": "https://k8s.gcr.io/auth",
  "k8s.hxstarrys.me": "https://registry.k8s.io/auth",
  "ghcr.hxstarrys.me": "https://ghcr.io/auth",
  "cloudsmith.hxstarrys.me": "https://docker.cloudsmith.io/auth",
  "suse.hxstarrys.me": "https://registry.suse.com/404",
  "opensuse.hxstarrys.me": "https://registry.opensuse.org/404",
};

const routes = {
  "docker.hxstarrys.me": "https://registry-1.docker.io",
  "quay.hxstarrys.me": "https://quay.io",
  "gcr.hxstarrys.me": "https://gcr.io",
  "k8s-gcr.hxstarrys.me": "https://k8s.gcr.io",
  "k8s.hxstarrys.me": "https://registry.k8s.io",
  "ghcr.hxstarrys.me": "https://ghcr.io",
  "cloudsmith.hxstarrys.me": "https://docker.cloudsmith.io",
  "suse.hxstarrys.me": "https://registry.suse.com",
  "opensuse.hxstarrys.me": "https://registry.opensuse.org",
};

function routeByHosts(host) {
  if (host in routes) {
    return routes[host];
  }
  if (MODE == "debug") {
    return TARGET_UPSTREAM;
  }
  return "";
}

function routeAuthByHosts(host) {
  if (host in routeAuths) {
    return routeAuths[host];
  }
  if (MODE == "debug") {
    return TARGET_UPSTREAM;
  }
  return "";
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const upstream = routeByHosts(url.hostname);
  const authUpstream = routeAuthByHosts(url.hostname);
  if (upstream === "" || authUpstream === "") {
    return new Response(
      JSON.stringify({
        routes: routes,
      }),
      {
        status: 404,
      }
    );
  }

  // Handle auth
  if (url.pathname == "/v2/auth") {
    const newUrl = new URL(authUpstream);
    const newReq = new Request(newUrl, {
      method: request.method,
      headers: request.headers,
      redirect: "follow",
    });
    return await fetch(newReq);
  }

  // default foward requests
  const newUrl = new URL(upstream + url.pathname);
  const newReq = new Request(newUrl, {
    method: request.method,
    headers: request.headers,
    redirect: "follow",
  });
  return await fetch(newReq);
}

function parseAuthenticate(authenticateStr) {
  // sample: Bearer realm="https://auth.ipv6.docker.com/token",service="registry.docker.io"
  // match strings after =" and before "
  const re = /(?<=\=")(?:\\.|[^"\\])*(?=")/g;
  const matches = authenticateStr.match(re);
  if (matches === null || matches.length < 2) {
    throw new Error(`invalid Www-Authenticate Header: ${authenticateStr}`);
  }
  return {
    realm: matches[0],
    service: matches[1],
  };
}

async function fetchToken(wwwAuthenticate, searchParams) {
  const url = new URL(wwwAuthenticate.realm);
  if (wwwAuthenticate.service.length) {
    url.searchParams.set("service", wwwAuthenticate.service);
  }
  if (searchParams.get("scope")) {
    url.searchParams.set("scope", searchParams.get("scope"));
  }
  return await fetch(url, { method: "GET", headers: {} });
}
